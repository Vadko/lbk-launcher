import { F } from '@mobily/ts-belt';
import pMemoize from 'p-memoize';
import pWaitFor from 'p-wait-for';
import { appEvents } from '@/main/app-events';
import { syncBridgePluginSetup } from '@/main/plugin-host/bridge-plugin-setup';
import { isPluginConnected } from '@/main/steam-bridge-server/bridge-server';
import { isCefFlagFilePresent } from '@/main/utils/cef-flag-file';
import { detectMillennium } from '@/main/utils/millennium';
import {
  getSteamBridgeStatus,
  noteBridgeAvailable,
  noteBridgeUnavailable,
  notePluginDisconnected,
  refreshSteamBridgeStatus,
} from '@/main/utils/steam-bridge';
import { recordBlockedVerdict } from '@/main/utils/steam-bridge-verdict';
import { resetCefEndpointCache, resolveCefEndpoint } from '@/main/utils/steam-cef';
import { isCefDebuggingEnabledInSettings } from '@/main/utils/store-storage';

type VerifyOutcome = 'ready' | 'blocked' | 'unknown';

const VERIFY_WINDOW_MS = 60000;
const VERIFY_POLL_MS = 2000;
// A webhelper younger than this may simply not have opened its port yet.
const VERIFY_MIN_HELPER_AGE_MS = 20000;

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
  let helperSeenAt: number | null = null;
  let unreadable = false;
  let portAssumed = false;

  const settled = await pWaitFor<VerifyOutcome | null>(
    async () => {
      if (isPluginConnected()) {
        noteBridgeAvailable('plugin');
        return pWaitFor.resolveWith('ready');
      }
      if (waitForPluginOnly) {
        return false;
      }
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
        return pWaitFor.resolveWith('ready');
      }
      if (step === 'blocked') {
        console.warn(
          '[SteamBridge] Steam runs CDP over a pipe; only the plugin can connect'
        );
        return pWaitFor.resolveWith('blocked');
      }
      if (step === 'plugin-only') {
        console.log('[SteamBridge] CDP is on a pipe; waiting for the Millennium plugin');
        waitForPluginOnly = true;
        return false;
      }
      if (discovery && discovery.kind !== 'none' && helperSeenAt === null) {
        helperSeenAt = Date.now();
      }
      unreadable = discovery?.kind === 'unreadable';
      portAssumed = discovery?.kind === 'port' && discovery.assumed === true;
      return false;
    },
    {
      interval: VERIFY_POLL_MS,
      timeout: { milliseconds: VERIFY_WINDOW_MS, fallback: () => null },
    }
  );
  if (settled) {
    return settled;
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
  recordBlockedVerdict(evidence);
  console.warn(`[SteamBridge] Steam did not open CDP after ${trigger}: ${evidence}`);
  return 'blocked';
}

async function verifyAndRefresh(
  trigger: 'lbk-restart' | 'observed-start'
): Promise<VerifyOutcome> {
  try {
    return await runVerify(trigger);
  } catch (error) {
    console.warn('[SteamBridge] Bridge verification failed:', error);
    return 'unknown';
  } finally {
    void refreshSteamBridgeStatus();
  }
}

// One verification at a time; a second trigger joins the running one.
export const verifyBridgeAfterLaunch = pMemoize(verifyAndRefresh, {
  cache: false,
  cacheKey: () => 'verify',
});

// Plugin setup runs here and on the toggle, a recheck and a host change, never per status computation.
export const startSteamBridge = F.once((): void => {
  appEvents.on('plugin-connection', async (connected) => {
    if (connected) {
      noteBridgeAvailable('plugin');
    } else {
      notePluginDisconnected();
    }
    await refreshSteamBridgeStatus();
  });

  // Millennium appears, and a failed plugin install or enable gets its retry, around a Steam restart.
  appEvents.on('steam-started', async () => {
    resetCefEndpointCache();
    await syncBridgePluginSetup();
    const status = await getSteamBridgeStatus();
    if (status.code === 'restart-pending') {
      await verifyBridgeAfterLaunch('observed-start');
    }
  });

  appEvents.on('steam-exited', async () => {
    resetCefEndpointCache();
    noteBridgeUnavailable();
    await syncBridgePluginSetup();
    await refreshSteamBridgeStatus();
  });

  void syncBridgePluginSetup().then(refreshSteamBridgeStatus);
});
