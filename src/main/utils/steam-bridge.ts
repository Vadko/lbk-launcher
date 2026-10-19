import * as fs from 'node:fs';
import {
  BRIDGE_PLUGIN_NAME,
  type BridgeHost,
  type SteamOpName,
  type SteamOps,
} from '@lbk/bridge-core/contract';
import { appEvents } from '@/main/app-events';
import { syncBridgePluginSetup } from '@/main/plugin-host/bridge-plugin-setup';
import {
  deckyStateFor,
  getAchievementsBadge,
  getHostSnapshot,
  pendingMillenniumAction,
} from '@/main/plugin-host/state';
import {
  getConnectedPluginInfo,
  invokeViaPlugin,
  isPluginConnected,
} from '@/main/steam-bridge-server/bridge-server';
import { PluginBridgeError } from '@/main/steam-bridge-server/protocol';
import { getPendingSteamActions } from '@/main/steam-pending-actions/queue';
import { findSteamPids, isSteamElevated } from '@/main/steam-process/lifecycle';
import { isCefFlagFilePresent } from '@/main/utils/cef-flag-file';
import { detectMillennium, planEnabledPluginsEdit } from '@/main/utils/millennium';
import { getMillenniumPluginState } from '@/main/utils/millennium-plugin';
import { isGamescopeSession } from '@/main/utils/platform';
import {
  claimPromptForFingerprint,
  clearBlockedVerdict,
  clearSteamBridgeVerdict,
  isBlockedVerdictPresent,
} from '@/main/utils/steam-bridge-verdict';
import {
  invokeViaCdp,
  resetCefEndpointCache,
  resolveCefEndpoint,
} from '@/main/utils/steam-cef';
import { isCefDebuggingEnabledInSettings } from '@/main/utils/store-storage';
import { sendToRenderer } from '@/main/window';
import type {
  SteamBridgeStatus,
  SteamBridgeStatusCode,
} from '@/shared/plugin-host-types';
import type { SteamBridgeFailure } from '@/shared/types';
import { compareVersions } from '@/shared/version';

type SteamBridgeTransport = 'cdp' | 'plugin';

export interface SteamBridge {
  transport: SteamBridgeTransport;
  invoke<K extends SteamOpName>(
    op: K,
    args: SteamOps[K]['args']
  ): Promise<SteamOps[K]['result']>;
}

const DEFAULT_OP_TIMEOUT_MS = 15000;
const SLOW_OP_TIMEOUT_MS = 30000;
const SLOW_OPS: ReadonlySet<SteamOpName> = new Set(['setArtwork', 'syncCollection']);
let lastTransport: SteamBridgeTransport | null = null;
let lastPublished: string | null = null;

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
      if (
        error instanceof PluginBridgeError &&
        (error.code === 'not-connected' || error.code === 'outdated')
      ) {
        const { endpoint } = await resolveCefEndpoint();
        if (endpoint) {
          return invokeViaCdp(op, args, opTimeout(op));
        }
      }
      throw error;
    }
  },
};

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

// A Decky plugin reloads on install; Millennium loads the new files only when Steam starts.
export function pluginUpdateAfterRestart(i: {
  settingOn: boolean;
  connected: { host: BridgeHost; pluginVersion: string } | null;
  installedVersion: string | null;
  millenniumRemovalQueued: boolean;
}): boolean {
  return (
    i.settingOn &&
    !i.millenniumRemovalQueued &&
    i.connected?.host === 'millennium' &&
    i.installedVersion !== null &&
    compareVersions(i.connected.pluginVersion, i.installedVersion) < 0
  );
}

export function noteBridgeAvailable(transport: SteamBridgeTransport): void {
  if (lastTransport === transport) {
    return;
  }
  lastTransport = transport;
  clearBlockedVerdict();
  console.log(`[SteamBridge] Steam bridge available via ${transport}`);
  appEvents.emit('bridge-ready');
}

export function noteBridgeUnavailable(): void {
  lastTransport = null;
}

export function notePluginDisconnected(): void {
  if (lastTransport === 'plugin') {
    noteBridgeUnavailable();
  }
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

const FAILURE_FOR_STATUS: Record<
  SteamBridgeStatusCode,
  Exclude<SteamBridgeFailure, 'failed'>
> = {
  ok: 'cef-unavailable',
  'setting-off': 'cef-unavailable',
  'restart-pending': 'cef-unavailable',
  'steam-not-running': 'steam-not-running',
  'cef-blocked': 'cef-blocked',
  'millennium-plugin-pending': 'millennium-plugin-pending',
  'millennium-outdated': 'millennium-outdated',
};

export async function ensureSteamBridge(): Promise<
  SteamBridge | Exclude<SteamBridgeFailure, 'failed'>
> {
  const bridge = await getSteamBridge();
  if (bridge) {
    return bridge;
  }
  return FAILURE_FOR_STATUS[(await getSteamBridgeStatus()).code];
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
  const millennium = detectMillennium();
  const pluginState = getMillenniumPluginState();
  const connectedPlugin = getConnectedPluginInfo();
  const connected = connectedPlugin !== null;

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

  const verdictPresent = isBlockedVerdictPresent();
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
        updateAfterRestart: pluginUpdateAfterRestart({
          settingOn,
          connected: connectedPlugin,
          installedVersion: pluginState.installedVersion,
          millenniumRemovalQueued: pendingMillenniumAction() === 'deactivate',
        }),
      },
    },
    steamElevated,
    gamescope,
    canRestartSteam: steamRunning && !steamElevated && !gamescope,
    pendingLaunchOptions: pendingLaunchOptions(),
    // The status copy names the plugin that is actually connected, not the host LBK would pick.
    pluginHost: transport === 'plugin' ? (connectedPlugin?.host ?? host.host) : host.host,
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

export async function recheckSteamBridge(): Promise<SteamBridgeStatus> {
  clearSteamBridgeVerdict();
  resetCefEndpointCache();
  await syncBridgePluginSetup();
  return getSteamBridgeStatus();
}

// Allows the toggle's restart prompt at most once per bridge fingerprint (BRIDGE §3.5).
export async function claimSteamRestartPrompt(): Promise<boolean> {
  const status = await getSteamBridgeStatus();
  if (status.code !== 'restart-pending' || !status.canRestartSteam) {
    return false;
  }
  return isCefFlagFilePresent() && claimPromptForFingerprint();
}
