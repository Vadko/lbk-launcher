import { hash } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import {
  BRIDGE_PLUGIN_NAME,
  type SteamOpName,
  type SteamOps,
} from '@lbk/bridge-core/contract';
import { z } from 'zod';
import { getSteamPath } from '@/main/game-detector/steam';
import {
  deckyStateFor,
  getAchievementsBadge,
  getHostSnapshot,
} from '@/main/plugin-host/state';
import {
  getPendingSteamActions,
  onSteamExited,
  onSteamStarted,
} from '@/main/steam-pending-actions';
import { isCefFlagFilePresent, syncBridgePluginSetup } from '@/main/utils/cef-flag-file';
import { detectMillennium, planEnabledPluginsEdit } from '@/main/utils/millennium';
import { getMillenniumPluginState } from '@/main/utils/millennium-plugin';
import { forCurrentOS, isGamescopeSession } from '@/main/utils/platform';
import {
  getConnectedPluginInfo,
  invokeViaPlugin,
  isPluginConnected,
  onPluginConnectionChange,
} from '@/main/utils/steam-bridge-server';
import {
  invokeViaCdp,
  resetCefEndpointCache,
  resolveCefEndpoint,
} from '@/main/utils/steam-cef';
import { findSteamPids, isSteamElevated } from '@/main/utils/steam-process';
import {
  deleteStoreValue,
  isCefDebuggingEnabledInSettings,
  readStoreValue,
  writeStoreValue,
} from '@/main/utils/store-storage';
import { sendToRenderer } from '@/main/window';
import { errorMessage } from '@/shared/errors';
import type {
  SteamBridgeStatus,
  SteamBridgeStatusCode,
} from '@/shared/plugin-host-types';
import type { SteamBridgeFailure } from '@/shared/types';

type SteamBridgeTransport = 'cdp' | 'plugin';

export interface SteamBridge {
  transport: SteamBridgeTransport;
  invoke<K extends SteamOpName>(
    op: K,
    args: SteamOps[K]['args']
  ): Promise<SteamOps[K]['result']>;
}

type VerifyOutcome = 'ready' | 'blocked' | 'unknown';

// Main-only key, but the renderer's generic store setter can write any name, so the shape is checked.
const bridgeVerdictSchema = z.object({
  verdict: z.literal('blocked-no-port'),
  fingerprint: z.string(),
  decidedAt: z.string(),
  evidence: z.array(z.string()),
});

type BridgeVerdict = z.infer<typeof bridgeVerdictSchema>;

const VERDICT_KEY = 'steam-bridge-verdict';
const PROMPTED_KEY = 'steam-restart-prompted';
const DEFAULT_OP_TIMEOUT_MS = 15000;
const SLOW_OP_TIMEOUT_MS = 30000;
const SLOW_OPS: ReadonlySet<SteamOpName> = new Set(['setArtwork', 'syncCollection']);
const VERIFY_WINDOW_MS = 60000;
const VERIFY_POLL_MS = 2000;
// A webhelper younger than this may simply not have opened its port yet.
const VERIFY_MIN_HELPER_AGE_MS = 20000;

let lastTransport: SteamBridgeTransport | null = null;
let lastPublished: string | null = null;
let verifying: Promise<VerifyOutcome> | null = null;
let started = false;
const readyListeners = new Set<(bridge: SteamBridge) => void>();

function opTimeout(op: SteamOpName): number {
  return SLOW_OPS.has(op) ? SLOW_OP_TIMEOUT_MS : DEFAULT_OP_TIMEOUT_MS;
}

const cdpBridge: SteamBridge = {
  transport: 'cdp',
  invoke: (op, args) => invokeViaCdp(op, args, opTimeout(op)),
};

const pluginBridge: SteamBridge = {
  transport: 'plugin',
  invoke: async (op, args) => {
    try {
      return await invokeViaPlugin(op, args, opTimeout(op));
    } catch (error) {
      // Only errors raised before the request reached Steam are safe to retry over CDP.
      const message = errorMessage(error, '');
      if (message === 'plugin-not-connected' || message === 'plugin-outdated') {
        const { endpoint } = await resolveCefEndpoint();
        if (endpoint) {
          return invokeViaCdp(op, args, opTimeout(op));
        }
      }
      throw error;
    }
  },
};

function bridgeFor(transport: SteamBridgeTransport): SteamBridge {
  return transport === 'plugin' ? pluginBridge : cdpBridge;
}

export function computeBridgeFingerprint(i: {
  millenniumEvidence: string[];
  steamClientMtimeMs: number | null;
  flagPresent: boolean;
}): string {
  const canonical = JSON.stringify({
    millenniumEvidence: [...i.millenniumEvidence].sort(),
    steamClientMtimeMs: i.steamClientMtimeMs,
    flagPresent: i.flagPresent,
  });
  return hash('sha1', canonical);
}

export function computeBridgeStatusCode(i: {
  settingOn: boolean;
  steamRunning: boolean;
  transport: SteamBridgeTransport | null;
  millenniumGeneration: 'v2' | 'v3' | null;
  blocksTcpCdp: boolean;
  cdpOnPipe: boolean;
  verdictPresent: boolean;
}): SteamBridgeStatusCode {
  if (!i.settingOn) {
    return 'setting-off';
  }
  if (!i.steamRunning) {
    return 'steam-not-running';
  }
  if (i.transport) {
    return 'ok';
  }
  if (i.millenniumGeneration === 'v2') {
    return 'millennium-outdated';
  }
  if ((i.millenniumGeneration === 'v3' && i.blocksTcpCdp) || i.cdpOnPipe) {
    return 'millennium-plugin-pending';
  }
  if (i.verdictPresent) {
    return 'cef-blocked';
  }
  return 'restart-pending';
}

function steamClientMtimeMs(): number | null {
  const steamPath = getSteamPath();
  if (!steamPath) {
    return null;
  }
  const candidates = forCurrentOS<string[]>({
    windows: ['steamclient64.dll', 'steamclient.dll'],
    linux: ['ubuntu12_32/steamclient.so'],
    macos: [
      'Steam.AppBundle/Steam/Contents/MacOS/steamclient.dylib',
      'steamclient.dylib',
    ],
    other: [],
  });
  for (const candidate of candidates) {
    try {
      return fs.statSync(path.join(steamPath, candidate)).mtimeMs;
    } catch {
      // Try the next candidate.
    }
  }
  return null;
}

function currentFingerprint(): string {
  return computeBridgeFingerprint({
    millenniumEvidence: detectMillennium().evidence,
    steamClientMtimeMs: steamClientMtimeMs(),
    flagPresent: isCefFlagFilePresent(),
  });
}

function readVerdict(fingerprint: string): BridgeVerdict | null {
  const raw = readStoreValue(VERDICT_KEY);
  if (raw === undefined) {
    return null;
  }
  const verdict = bridgeVerdictSchema.safeParse(raw).data;
  if (verdict?.fingerprint !== fingerprint) {
    deleteStoreValue(VERDICT_KEY);
    return null;
  }
  return verdict;
}

function clearVerdict(): void {
  if (readStoreValue(VERDICT_KEY) !== undefined) {
    deleteStoreValue(VERDICT_KEY);
    console.log('[SteamBridge] Cleared the blocked verdict');
  }
}

export function clearSteamBridgeVerdict(): void {
  clearVerdict();
  deleteStoreValue(PROMPTED_KEY);
}

function noteBridgeAvailable(transport: SteamBridgeTransport): void {
  if (lastTransport === transport) {
    return;
  }
  lastTransport = transport;
  clearVerdict();
  console.log(`[SteamBridge] Steam bridge available via ${transport}`);
  const bridge = bridgeFor(transport);
  for (const listener of readyListeners) {
    try {
      listener(bridge);
    } catch (error) {
      console.warn('[SteamBridge] Ready listener failed:', error);
    }
  }
}

function noteBridgeUnavailable(): void {
  lastTransport = null;
}

export function onSteamBridgeReady(cb: (bridge: SteamBridge) => void): () => void {
  readyListeners.add(cb);
  return () => {
    readyListeners.delete(cb);
  };
}

export async function getSteamBridge(): Promise<SteamBridge | null> {
  if (!isCefDebuggingEnabledInSettings()) {
    return null;
  }
  if (isPluginConnected()) {
    noteBridgeAvailable('plugin');
    return pluginBridge;
  }
  const { endpoint } = await resolveCefEndpoint();
  if (endpoint) {
    noteBridgeAvailable('cdp');
    return cdpBridge;
  }
  noteBridgeUnavailable();
  return null;
}

function failureFor(code: SteamBridgeStatusCode): Exclude<SteamBridgeFailure, 'failed'> {
  switch (code) {
    case 'steam-not-running':
    case 'cef-blocked':
    case 'millennium-plugin-pending':
    case 'millennium-outdated':
      return code;
    default:
      return 'cef-unavailable';
  }
}

export async function ensureSteamBridge(): Promise<
  SteamBridge | Exclude<SteamBridgeFailure, 'failed'>
> {
  const bridge = await getSteamBridge();
  if (bridge) {
    return bridge;
  }
  return failureFor((await getSteamBridgeStatus()).code);
}

function isPluginConfigUsable(configPath: string | null): boolean {
  if (!configPath) {
    return false;
  }
  try {
    const raw = fs.readFileSync(configPath, 'utf8');
    return planEnabledPluginsEdit(raw, BRIDGE_PLUGIN_NAME, true).kind !== 'invalid';
  } catch {
    return false;
  }
}

function pendingLaunchOptions(): SteamBridgeStatus['pendingLaunchOptions'] {
  const items: SteamBridgeStatus['pendingLaunchOptions'] = [];
  for (const action of getPendingSteamActions()) {
    if (action.kind === 'launch-options') {
      items.push({ gameId: action.gameId, gameName: action.gameName });
    }
  }
  return items;
}

async function computeStatus(): Promise<SteamBridgeStatus> {
  const settingOn = isCefDebuggingEnabledInSettings();
  if (settingOn) {
    syncBridgePluginSetup();
  }
  const millennium = detectMillennium();
  const pluginState = getMillenniumPluginState();
  const connected = isPluginConnected();

  let transport: SteamBridgeTransport | null = null;
  let steamRunning: boolean;
  let cdpOnPipe = false;
  if (settingOn && connected) {
    transport = 'plugin';
    steamRunning = true;
  } else if (settingOn) {
    const resolution = await resolveCefEndpoint();
    steamRunning = resolution.steamRunning;
    transport = resolution.endpoint ? 'cdp' : null;
    cdpOnPipe = resolution.discovery?.kind === 'pipe';
  } else {
    steamRunning = (await findSteamPids()).length > 0;
  }

  if (transport) {
    noteBridgeAvailable(transport);
  } else if (settingOn) {
    noteBridgeUnavailable();
  }

  const verdictPresent = readVerdict(currentFingerprint()) !== null;
  const steamElevated = steamRunning ? await isSteamElevated() : false;
  const gamescope = isGamescopeSession();
  const host = await getHostSnapshot();
  const achievements = await getAchievementsBadge({ steamRunning, snapshot: host });

  return {
    code: computeBridgeStatusCode({
      settingOn,
      steamRunning,
      transport,
      millenniumGeneration: millennium.generation,
      blocksTcpCdp: millennium.blocksTcpCdp,
      cdpOnPipe,
      verdictPresent,
    }),
    transport,
    millennium: {
      detected: millennium.installed,
      generation: millennium.generation,
      blocksTcpCdp: millennium.blocksTcpCdp,
      plugin: {
        supported:
          pluginState.supported &&
          pluginState.installed &&
          (pluginState.enabled || isPluginConfigUsable(millennium.configPath)),
        installed: pluginState.installed,
        enabled: pluginState.enabled,
        connected,
      },
    },
    steamElevated,
    gamescope,
    canRestartSteam: steamRunning && !steamElevated && !gamescope,
    pendingLaunchOptions: pendingLaunchOptions(),
    // The status copy names the plugin that is actually connected, not the host LBK would pick.
    pluginHost:
      transport === 'plugin' ? (getConnectedPluginInfo()?.host ?? host.host) : host.host,
    decky: deckyStateFor(host.decky),
    achievements,
  };
}

function publish(status: SteamBridgeStatus): void {
  const serialized = JSON.stringify(status);
  if (serialized === lastPublished) {
    return;
  }
  lastPublished = serialized;
  sendToRenderer('steam-bridge-status-changed', status);
}

export async function getSteamBridgeStatus(): Promise<SteamBridgeStatus> {
  const status = await computeStatus();
  publish(status);
  return status;
}

export async function refreshSteamBridgeStatus(): Promise<void> {
  try {
    await getSteamBridgeStatus();
  } catch (error) {
    console.warn('[SteamBridge] Status refresh failed:', error);
  }
}

export function recheckSteamBridge(): Promise<SteamBridgeStatus> {
  clearSteamBridgeVerdict();
  resetCefEndpointCache();
  if (isCefDebuggingEnabledInSettings()) {
    syncBridgePluginSetup({ force: true });
  }
  return getSteamBridgeStatus();
}

// Allows the toggle's restart prompt at most once per bridge fingerprint (BRIDGE §3.5).
export async function claimSteamRestartPrompt(): Promise<boolean> {
  const status = await getSteamBridgeStatus();
  if (status.code !== 'restart-pending' || !status.canRestartSteam) {
    return false;
  }
  if (!isCefFlagFilePresent()) {
    return false;
  }
  const fingerprint = currentFingerprint();
  if (readStoreValue(PROMPTED_KEY) === fingerprint) {
    return false;
  }
  writeStoreValue(PROMPTED_KEY, fingerprint);
  return true;
}

type VerifyStep = 'ready-plugin' | 'ready-cdp' | 'blocked' | 'plugin-only' | 'poll';

// A pipe only proves Steam has no TCP port; with Millennium v3 present its plugin may still connect.
export function nextVerifyStep(i: {
  pluginConnected: boolean;
  endpoint: boolean;
  discovery: 'port' | 'pipe' | 'none' | 'unreadable' | null;
  millenniumV3: boolean;
}): VerifyStep {
  if (i.pluginConnected) {
    return 'ready-plugin';
  }
  if (i.endpoint) {
    return 'ready-cdp';
  }
  if (i.discovery === 'pipe') {
    return i.millenniumV3 ? 'plugin-only' : 'blocked';
  }
  return 'poll';
}

async function runVerify(
  trigger: 'lbk-restart' | 'observed-start'
): Promise<VerifyOutcome> {
  if (!isCefDebuggingEnabledInSettings()) {
    return 'unknown';
  }
  const flagPresentAtLaunch = isCefFlagFilePresent();
  const millennium = detectMillennium();
  let waitForPluginOnly = millennium.generation === 'v3' && millennium.blocksTcpCdp;
  const startedAt = Date.now();
  let helperSeenAt: number | null = null;
  let unreadable = false;
  let portAssumed = false;

  while (Date.now() - startedAt < VERIFY_WINDOW_MS) {
    if (isPluginConnected()) {
      noteBridgeAvailable('plugin');
      return 'ready';
    }
    if (!waitForPluginOnly) {
      const resolution = await resolveCefEndpoint({ fresh: true });
      const discovery = resolution.discovery;
      const step = nextVerifyStep({
        pluginConnected: false,
        endpoint: Boolean(resolution.endpoint),
        discovery: discovery?.kind ?? null,
        millenniumV3: detectMillennium().generation === 'v3',
      });
      if (step === 'ready-cdp') {
        noteBridgeAvailable('cdp');
        return 'ready';
      }
      if (step === 'blocked') {
        console.warn(
          '[SteamBridge] Steam runs CDP over a pipe; only the plugin can connect'
        );
        return 'blocked';
      }
      if (step === 'plugin-only') {
        console.log('[SteamBridge] CDP is on a pipe; waiting for the Millennium plugin');
        waitForPluginOnly = true;
        await sleep(VERIFY_POLL_MS);
        continue;
      }
      if (discovery && discovery.kind !== 'none' && helperSeenAt === null) {
        helperSeenAt = Date.now();
      }
      unreadable = discovery?.kind === 'unreadable';
      portAssumed = discovery?.kind === 'port' && discovery.assumed === true;
    }
    await sleep(VERIFY_POLL_MS);
  }

  if (waitForPluginOnly) {
    return 'blocked';
  }
  if (unreadable || !flagPresentAtLaunch) {
    return 'unknown';
  }
  if (helperSeenAt === null || Date.now() - helperSeenAt < VERIFY_MIN_HELPER_AGE_MS) {
    return 'unknown';
  }

  let evidence: string;
  if (!isCefFlagFilePresent()) {
    evidence = 'flag-removed';
  } else if (portAssumed) {
    evidence = 'no-port-arg';
  } else {
    evidence = 'probe-failed';
  }
  const verdict: BridgeVerdict = {
    verdict: 'blocked-no-port',
    fingerprint: currentFingerprint(),
    decidedAt: new Date().toISOString(),
    evidence: [evidence],
  };
  writeStoreValue(VERDICT_KEY, verdict);
  console.warn(`[SteamBridge] Steam did not open CDP after ${trigger}: ${evidence}`);
  return 'blocked';
}

export function verifyBridgeAfterLaunch(
  trigger: 'lbk-restart' | 'observed-start'
): Promise<VerifyOutcome> {
  if (!verifying) {
    verifying = runVerify(trigger)
      .catch((error) => {
        console.warn('[SteamBridge] Bridge verification failed:', error);
        return 'unknown' as const;
      })
      .finally(() => {
        verifying = null;
        void refreshSteamBridgeStatus();
      });
  }
  return verifying;
}

export function startSteamBridge(): void {
  if (started) {
    return;
  }
  started = true;

  if (isCefDebuggingEnabledInSettings()) {
    syncBridgePluginSetup();
  }

  onPluginConnectionChange((connected) => {
    if (connected) {
      noteBridgeAvailable('plugin');
    } else if (lastTransport === 'plugin') {
      noteBridgeUnavailable();
    }
    void refreshSteamBridgeStatus();
  });

  onSteamStarted(() => {
    resetCefEndpointCache();
    void (async () => {
      const status = await getSteamBridgeStatus();
      if (status.code === 'restart-pending') {
        await verifyBridgeAfterLaunch('observed-start');
      }
    })().catch((error) => {
      console.warn('[SteamBridge] Observed-start check failed:', error);
    });
  });

  onSteamExited(() => {
    resetCefEndpointCache();
    noteBridgeUnavailable();
    void refreshSteamBridgeStatus();
  });

  void refreshSteamBridgeStatus();
}
