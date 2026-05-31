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
import * as path from 'node:path';
import { getSteamPath } from '@/main/game-detector/steam';
import { getMainWindow } from '@/main/window';
import { isCefAvailable } from './steam-cef';
import { isSteamRunning } from './steam-launcher';

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
 * Steam looks for the flag file alongside `config/`, `userdata/`, etc. — the
 * folder that `getSteamPath()` returns. On Linux that's `~/.steam/steam` or
 * the Flatpak data dir; on Windows the install dir; on macOS
 * `~/Library/Application Support/Steam`.
 */
function getFlagFilePath(): string | null {
  const steamPath = getSteamPath();
  if (!steamPath) return null;
  return path.join(steamPath, FLAG_FILE_NAME);
}

function isMillenniumInstalled(): boolean {
  const steamPath = getSteamPath();
  if (!steamPath) return false;
  return MILLENNIUM_MARKERS.some((marker) => fs.existsSync(path.join(steamPath, marker)));
}

/**
 * Make sure the flag file exists. Idempotent — calling it many times is fine.
 */
function ensureCefFlagFile(): void {
  const filePath = getFlagFilePath();
  if (!filePath) {
    console.warn('[CEFFlagFile] Steam path not found, cannot create flag file');
    return;
  }

  if (fs.existsSync(filePath)) return;

  try {
    // `wx` = create exclusively; treat EEXIST as already-there so two parallel
    // callers don't race each other.
    fs.writeFileSync(filePath, '', { flag: 'wx' });
    console.log(
      `[CEFFlagFile] Created ${filePath} — Steam restart needed for it to take effect`
    );
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'EEXIST') return;
    console.error('[CEFFlagFile] Failed to create flag file:', error);
  }
}

/**
 * Called once at app startup. Ensures the flag file exists, then if Steam is
 * running but the debug port isn't open yet (= Steam started before the flag
 * was created), forces a mandatory "restart Steam" prompt in the renderer.
 * After that restart the debug port stays open until the user deletes the
 * flag file, so installs never need to prompt for a restart later.
 */
export async function bootstrapCefDebugging(): Promise<void> {
  if (isMillenniumInstalled()) {
    // Pointless to drop the flag file or nag the user — Millennium will delete
    // it again on the next Steam start. Launch-option installs that need CEF
    // will silently fall back to a noop (logged in writeSteamLaunchOptions).
    console.log('[CEFFlagFile] Millennium detected, skipping CEF bootstrap');
    return;
  }

  ensureCefFlagFile();

  if (!(await isSteamRunning())) return;
  if (await isCefAvailable()) return;

  getMainWindow()?.webContents.send('steam-restart-required');
}
