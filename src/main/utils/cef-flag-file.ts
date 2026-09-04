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
import { getMainWindow } from '@/main/window';
import { isMacOS } from './platform';
import { isCefAvailable } from './steam-cef';
import { isSteamRunning } from './steam-launcher';
import { isCefDebuggingEnabledInSettings } from './store-storage';

const FLAG_FILE_NAME = '.cef-enable-remote-debugging';

/**
 * File paths (relative to Steam install dir) that indicate the Millennium
 * Steam mod is installed. Either layout makes Steam's CEF endpoint unreachable
 * for us: vanilla v2 actively deletes our flag file, and v3 routes CDP
 * exclusively over anonymous pipes inside `steamwebhelper` so there's no TCP
 * port to probe.
 *
 *   v3 (2026+) — DLL-hijack via `wsock32.dll`, main code under `millennium/`
 *   v2 legacy — root-dropped `millennium.dll` + `user32.dll.local` shim
 *
 * Refs:
 *   https://github.com/SteamClientHomebrew/Millennium/releases/tag/v3.0.0
 *   https://github.com/SteamClientHomebrew/Millennium/blob/main/src/instrumentation/internal/steam_hooks.cc
 */
const MILLENNIUM_MARKERS = [
  // v3
  'millennium/lib/millennium.dll',
  'wsock32.dll',
  // v2 legacy
  'millennium.dll',
  'user32.dll.local',
];

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

function isMillenniumInstalled(): boolean {
  const steamPath = getSteamPath();
  if (!steamPath) {
    return false;
  }
  return MILLENNIUM_MARKERS.some((marker) => fs.existsSync(path.join(steamPath, marker)));
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

/**
 * Ensure the flag file exists and, when asked to, prompt for a Steam restart
 * if the debug port isn't open yet. Startup never prompts — a restart dialog
 * before the user asked for anything is too aggressive, and flows that need
 * CEF right now (launch options during install) surface their own mandatory
 * prompt in useInstallation.
 */
async function enableCefDebugging(prompt: boolean): Promise<void> {
  if (isMillenniumInstalled()) {
    // Pointless to drop the flag file or nag the user — Millennium will delete
    // it again on the next Steam start. Launch-option installs that need CEF
    // will silently fall back to a noop (logged in writeSteamLaunchOptions).
    console.log('[CEFFlagFile] Millennium detected, skipping CEF bootstrap');
    return;
  }

  ensureCefFlagFile();

  if (!prompt) {
    return;
  }
  if (!(await isSteamRunning())) {
    return;
  }
  if (await isCefAvailable()) {
    return;
  }

  // User may have toggled off (file deleted) during the awaits — don't prompt.
  const filePath = getFlagFilePath();
  if (!filePath || !fs.existsSync(filePath)) {
    return;
  }

  getMainWindow()?.webContents.send('steam-restart-required');
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
  if (enabled) {
    await enableCefDebugging(opts.prompt ?? true);
  } else {
    removeCefFlagFile();
  }
}
