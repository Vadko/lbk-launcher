/**
 * Manage the `.cef-enable-remote-debugging` flag-file that tells Steam to
 * expose the Chromium DevTools protocol on localhost:8080. Steam reads this
 * file once at startup; creating it requires a Steam restart before the port
 * actually opens.
 *
 * Decky Loader's installer creates the same file the same way:
 * https://github.com/SteamDeckHomebrew/decky-installer/blob/main/cli/install_release.sh
 */

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { getSteamPath } from '@/main/game-detector/steam';
import { queueSteamAction } from '@/main/steam-pending-actions';
import { getMainWindow } from '@/main/window';
import { detectDeckyPluginSync, isDeckyInstalledSync } from './decky';
import { detectMillennium } from './millennium';
import {
  getMillenniumPluginState,
  installOrUpdateMillenniumPlugin,
  removeMillenniumPluginFiles,
  setMillenniumPluginEnabledInConfig,
} from './millennium-plugin';
import { isMacOS } from './platform';
import { removeOrphanDeckyPluginData, resyncBridgePluginData } from './plugin-data';
import {
  claimSteamRestartPrompt,
  clearSteamBridgeVerdict,
  refreshSteamBridgeStatus,
} from './steam-bridge';
import { startSteamBridgeServer, stopSteamBridgeServer } from './steam-bridge-server';
import { resetCefEndpointCache } from './steam-cef';
import { isCefDebuggingEnabledInSettings } from './store-storage';

const FLAG_FILE_NAME = '.cef-enable-remote-debugging';

/**
 * Steam reads the flag file from its working directory. On Windows/Linux that's
 * the data root, but on macOS the two differ and a flag file in the data root is
 * silently ignored — verified against client build 1785799196.
 */
const MACOS_APP_BUNDLE_SUBPATH = 'Steam.AppBundle/Steam/Contents/MacOS';

/** Most-correct first; later entries are legacy spots we clean up, never write to. */
function getFlagFileDirs(): string[] {
  const steamPath = getSteamPath();
  if (!steamPath) {
    return [];
  }
  if (!isMacOS()) {
    return [steamPath];
  }

  // Where older builds wrote it — `detectSteamPathMacOS` may not return it.
  const legacyDataRoot = path.join(os.homedir(), 'Library/Application Support/Steam');

  // `/Applications/Steam.app/Contents/MacOS` is already the working directory.
  const primary = steamPath.endsWith(path.join('Contents', 'MacOS'))
    ? steamPath
    : path.join(steamPath, MACOS_APP_BUNDLE_SUBPATH);

  return [...new Set([primary, steamPath, legacyDataRoot])];
}

/** Where the flag file must live for Steam to act on it. */
function getFlagFilePath(): string | null {
  const dirs = getFlagFileDirs();
  if (dirs.length === 0) {
    return null;
  }
  // Falls back to the data root, which is at least guaranteed to exist.
  const dir = dirs.find((candidate) => fs.existsSync(candidate)) ?? dirs[dirs.length - 1];
  return path.join(dir, FLAG_FILE_NAME);
}

/** Every location a flag file could be sitting in, including stale ones. */
function getAllFlagFilePaths(): string[] {
  return getFlagFileDirs().map((dir) => path.join(dir, FLAG_FILE_NAME));
}

/** Delete one flag file; a missing file is already the desired end state. */
function unlinkFlagFile(filePath: string): void {
  try {
    fs.unlinkSync(filePath);
    console.log(`[CEFFlagFile] Removed ${filePath}`);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return;
    }
    console.error('[CEFFlagFile] Failed to remove flag file:', error);
  }
}

/**
 * Make sure the flag file exists where Steam reads it, and nowhere else.
 * Idempotent — calling it many times is fine.
 */
function ensureCefFlagFile(): void {
  const filePath = getFlagFilePath();
  if (!filePath) {
    console.warn('[CEFFlagFile] Steam path not found, cannot create flag file');
    return;
  }

  // Older builds dropped it where Steam never looks — leave only the copy that works.
  for (const stale of getAllFlagFilePaths()) {
    if (stale !== filePath && fs.existsSync(stale)) {
      unlinkFlagFile(stale);
    }
  }

  if (fs.existsSync(filePath)) {
    return;
  }

  try {
    // `wx` = create exclusively; treat EEXIST as already-there so two parallel
    // callers don't race each other.
    fs.writeFileSync(filePath, '', { flag: 'wx' });
    console.log(
      `[CEFFlagFile] Created ${filePath} — Steam restart needed for it to take effect`
    );
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'EEXIST') {
      return;
    }
    console.error('[CEFFlagFile] Failed to create flag file:', error);
  }
}

/** Remove the flag file. The debug port closes on the next Steam restart. */
function removeCefFlagFile(): void {
  for (const filePath of getAllFlagFilePaths()) {
    unlinkFlagFile(filePath);
  }
}

export function isCefFlagFilePresent(): boolean {
  const filePath = getFlagFilePath();
  return filePath !== null && fs.existsSync(filePath);
}

let millenniumSetupKey: string | null = null;
// undefined until the first pass, so a missing plugin still gets its orphan cleanup once.
let deckySetupKey: string | null | undefined;

function applyPluginEnabled(enable: boolean): void {
  const result = setMillenniumPluginEnabledInConfig(enable);
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

// Installs, enables and serves LBK Bridge for Millennium v3 and serves the Decky copy; memoized per detected install.
export function syncBridgePluginSetup(opts: { force?: boolean } = {}): void {
  if (isCefDebuggingEnabledInSettings()) {
    setupMillenniumPlugin(opts.force ?? false);
    setupDeckyPlugin(opts.force ?? false);
  }
}

function startBridgeServer(): void {
  startSteamBridgeServer().catch((error) => {
    console.warn('[SteamBridge] Plugin server failed to start:', error);
  });
}

// Decky installs the plugin itself, through its own prompt; LBK only serves it.
function setupDeckyPlugin(force: boolean): void {
  const decky = detectDeckyPluginSync();
  const key = decky?.plugin.installed
    ? `${decky.plugin.dir}|${decky.plugin.version}|${decky.plugin.disabled}`
    : null;
  if (key === deckySetupKey && !force) {
    return;
  }
  deckySetupKey = key;
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

function setupMillenniumPlugin(force: boolean): void {
  const info = detectMillennium();
  if (info.generation !== 'v3') {
    millenniumSetupKey = null;
    return;
  }
  const key = `${info.pluginsDir}|${info.configPath}`;
  if (millenniumSetupKey === key && !force) {
    return;
  }
  millenniumSetupKey = key;

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
  if (!getMillenniumPluginState().enabled) {
    applyPluginEnabled(true);
  }
}

// Startup never prompts; the toggle prompts at most once per bridge fingerprint.
async function enableCefDebugging(prompt: boolean): Promise<void> {
  setupMillenniumPlugin(false);
  setupDeckyPlugin(false);

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
    getMainWindow()?.webContents.send('steam-restart-required');
  }
}

function disableCefDebugging(): void {
  millenniumSetupKey = null;
  deckySetupKey = undefined;
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
      applyPluginEnabled(false);
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
  resetCefEndpointCache();
  if (enabled) {
    await enableCefDebugging(opts.prompt ?? true);
  } else {
    disableCefDebugging();
    // Turning the setting off and on again allows one more restart prompt (BRIDGE §3.4 rule d).
    clearSteamBridgeVerdict();
  }
  await refreshSteamBridgeStatus();
}
