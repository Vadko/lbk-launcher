import pLimit from 'p-limit';
import {
  startSteamBridgeServer,
  stopSteamBridgeServer,
} from '@/main/steam-bridge-server/bridge-server';
import { queueSteamAction } from '@/main/steam-pending-actions';
import { getPendingSteamActions } from '@/main/steam-pending-actions/queue';
import { ensureCefFlagFile, removeCefFlagFile } from '@/main/utils/cef-flag-file';
import { detectDeckyPluginSync, isDeckyInstalledSync } from '@/main/utils/decky';
import { detectMillennium } from '@/main/utils/millennium';
import {
  getMillenniumPluginState,
  installOrUpdateMillenniumPlugin,
  removeMillenniumPluginFiles,
  setMillenniumPluginEnabledInConfig,
} from '@/main/utils/millennium-plugin';
import {
  removeOrphanDeckyPluginData,
  resyncBridgePluginData,
} from '@/main/utils/plugin-data';
import {
  claimSteamRestartPrompt,
  refreshSteamBridgeStatus,
} from '@/main/utils/steam-bridge';
import { clearSteamBridgeVerdict } from '@/main/utils/steam-bridge-verdict';
import { resetCefEndpointCache } from '@/main/utils/steam-cef';
import { isCefDebuggingEnabledInSettings } from '@/main/utils/store-storage';
import { sendToRenderer } from '@/main/window';

// Each run decides from the plugin state and setting it reads, so the next one starts only once it is done.
const setupRuns = pLimit(1);

async function applyPluginEnabled(enable: boolean): Promise<void> {
  const result = await setMillenniumPluginEnabledInConfig(enable);
  if (result === 'steam-running') {
    queueSteamAction({
      kind: 'millennium-plugin',
      enable,
      queuedAt: new Date().toISOString(),
    });
    console.log(
      `[Millennium] Plugin ${enable ? 'enable' : 'disable'} queued until Steam exits`
    );
    return;
  }
  if (result === 'invalid-config' || result === 'no-config') {
    console.warn(
      `[Millennium] Cannot ${enable ? 'enable' : 'disable'} the plugin: ${result}`
    );
    return;
  }
  if (!enable) {
    removeMillenniumPluginFiles();
  }
}

// Installs, enables and serves LBK Bridge for Millennium v3 and serves the Decky copy; every trigger reruns it. Never rejects.
export function syncBridgePluginSetup(): Promise<void> {
  return setupRuns(async () => {
    if (!isCefDebuggingEnabledInSettings()) {
      return;
    }
    try {
      await setupMillenniumPlugin();
      setupDeckyPlugin();
    } catch (error) {
      console.warn('[SteamBridge] Plugin setup failed:', error);
    }
  });
}

function startBridgeServer(): void {
  startSteamBridgeServer().catch((error) => {
    console.warn('[SteamBridge] Plugin server failed to start:', error);
  });
}

// Decky installs the plugin itself, through its own prompt; LBK only serves it.
function setupDeckyPlugin(): void {
  const decky = detectDeckyPluginSync();
  if (!decky) {
    return;
  }
  if (!decky.plugin.installed) {
    removeOrphanDeckyPluginData();
    return;
  }
  startBridgeServer();
  resyncBridgePluginData();
}

// A queued enable already waits for Steam's exit; queueing it again would only rewrite the queue.
function isEnableQueued(): boolean {
  return getPendingSteamActions().some((a) => a.kind === 'millennium-plugin' && a.enable);
}

async function setupMillenniumPlugin(): Promise<void> {
  if (detectMillennium().generation !== 'v3') {
    return;
  }
  const installed = installOrUpdateMillenniumPlugin();
  if (!installed.ok) {
    console.warn('[Millennium] Plugin install failed:', installed.error);
    return;
  }
  if (installed.changed) {
    console.log('[Millennium] Plugin installed or updated');
    resyncBridgePluginData();
  }
  startBridgeServer();
  if (!getMillenniumPluginState().enabled && !isEnableQueued()) {
    await applyPluginEnabled(true);
  }
}

// Startup never prompts; the toggle prompts at most once per bridge fingerprint.
async function enableCefDebugging(prompt: boolean): Promise<void> {
  await setupMillenniumPlugin();
  setupDeckyPlugin();

  const millennium = detectMillennium();
  if (millennium.blocksTcpCdp) {
    // Millennium deletes the flag file on Steam start and shows a message box when it cannot.
    console.log(
      '[CEFFlagFile] Millennium closes the CDP port, leaving the flag file alone'
    );
    return;
  }

  ensureCefFlagFile();

  if (prompt && (await claimSteamRestartPrompt())) {
    sendToRenderer('steam-restart-required');
  }
}

async function disableCefDebugging(): Promise<void> {
  const millennium = detectMillennium();
  // Decky creates the same file only in its installer and never restores it.
  if (!millennium.blocksTcpCdp && !isDeckyInstalledSync()) {
    removeCefFlagFile();
  }
  stopSteamBridgeServer().catch((error) => {
    console.warn('[SteamBridge] Plugin server failed to stop:', error);
  });
  if (millennium.generation === 'v3') {
    const plugin = getMillenniumPluginState();
    if (plugin.installed || plugin.enabled) {
      await applyPluginEnabled(false);
    }
  }
}

/** Startup: sync the flag file with the persisted setting, without prompting. */
export async function bootstrapCefDebugging(): Promise<void> {
  await setCefDebuggingEnabled(isCefDebuggingEnabledInSettings(), { prompt: false });
}

/** Live toggle from Settings — the renderer persists the value, this syncs the file now. */
export async function setCefDebuggingEnabled(
  enabled: boolean,
  opts: { prompt?: boolean } = {}
): Promise<void> {
  await setupRuns(async () => {
    resetCefEndpointCache();
    if (enabled) {
      await enableCefDebugging(opts.prompt ?? true);
    } else {
      await disableCefDebugging();
      // Turning the setting off and on again allows one more restart prompt (BRIDGE §3.4 rule d).
      clearSteamBridgeVerdict();
    }
  });
  await refreshSteamBridgeStatus();
}
