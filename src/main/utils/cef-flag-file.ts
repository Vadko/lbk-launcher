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
  ensureCefFlagFile();

  if (!(await isSteamRunning())) return;
  if (await isCefAvailable()) return;

  getMainWindow()?.webContents.send('steam-restart-required');
}
