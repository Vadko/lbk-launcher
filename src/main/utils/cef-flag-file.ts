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
import { errnoCode } from '@/shared/errors';
import { detectMillennium } from './millennium';
import { isMacOS } from './platform';
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
    if (errnoCode(error) === 'ENOENT') {
      return;
    }
    console.error('[CEFFlagFile] Failed to remove flag file:', error);
  }
}

/**
 * Make sure the flag file exists where Steam reads it, and nowhere else.
 * Idempotent — calling it many times is fine.
 */
export function ensureCefFlagFile(): void {
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
    if (errnoCode(error) === 'EEXIST') {
      return;
    }
    console.error('[CEFFlagFile] Failed to create flag file:', error);
  }
}

/** Remove the flag file. The debug port closes on the next Steam restart. */
export function removeCefFlagFile(): void {
  for (const filePath of getAllFlagFilePaths()) {
    unlinkFlagFile(filePath);
  }
}

// Millennium deleted the flag on every Steam start, so after it is gone nothing else would bring CDP back.
export function restoreCefFlagFileAfterMillennium(): void {
  if (isCefDebuggingEnabledInSettings() && !detectMillennium().blocksTcpCdp) {
    ensureCefFlagFile();
  }
}

export function isCefFlagFilePresent(): boolean {
  const filePath = getFlagFilePath();
  return filePath !== null && fs.existsSync(filePath);
}
