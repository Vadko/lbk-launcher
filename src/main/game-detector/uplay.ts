/**
 * Ubisoft Connect (Uplay) Detection
 *
 * Ported from Playnite's UplayLibrary (MIT):
 * https://github.com/JosefNemec/PlayniteExtensions — source/Libraries/UplayLibrary
 * Installed games live in the registry under Ubisoft\Launcher\Installs\{id}
 * with an InstallDir value (forward slashes).
 */

import * as fs from 'fs';
import * as path from 'path';
import { enumerateKeysSafe, HKEY } from 'registry-js';
import { isWindows } from '../utils/platform';
import { getRegistryString } from '../utils/registry';
import { logIfChanged } from './log-if-changed';

interface UplayInstalledGame {
  /** Numeric install id — also the uplay:// launch id. */
  installId: string;
  installDir: string;
}

/**
 * Read installed Ubisoft Connect games from the registry.
 * Checks the 32-bit view (WOW6432Node) first, then the 64-bit one.
 */
function getUplayInstalledGames(): UplayInstalledGame[] {
  if (!isWindows()) {
    return [];
  }

  const registryKeys = [
    'SOFTWARE\\WOW6432Node\\Ubisoft\\Launcher\\Installs',
    'SOFTWARE\\Ubisoft\\Launcher\\Installs',
  ];

  for (const registryKey of registryKeys) {
    const games: UplayInstalledGame[] = [];
    for (const installId of enumerateKeysSafe(HKEY.HKEY_LOCAL_MACHINE, registryKey)) {
      const value = getRegistryString(
        HKEY.HKEY_LOCAL_MACHINE,
        `${registryKey}\\${installId}`,
        'InstallDir'
      );
      // Registry stores forward slashes — normalize like Playnite does
      const installDir = value?.replace(/\//g, path.sep).replace(/[\\/]+$/, '');
      if (installDir && fs.existsSync(installDir)) {
        games.push({ installId, installDir });
      }
    }

    if (games.length > 0) {
      logIfChanged(
        'uplay-installed',
        `[Uplay] Found ${games.length} installed games in registry: ${games.map((g) => path.basename(g.installDir)).join(', ')}`
      );
      return games;
    }
  }

  return [];
}

/**
 * Find Ubisoft Connect game by folder name
 */
export function findUplayGame(gameFolderName: string): string | null {
  console.log(`[Uplay] Searching for game: "${gameFolderName}"`);

  const target = gameFolderName.toLowerCase();
  for (const game of getUplayInstalledGames()) {
    const folderName = path.basename(game.installDir);
    if (folderName.toLowerCase() === target) {
      console.log(`[Uplay] ✓ Game found: ${game.installDir}`);
      return game.installDir;
    }
  }

  console.warn(`[Uplay] ✗ Game "${gameFolderName}" not found`);
  return null;
}

/**
 * Get all installed Ubisoft Connect game folder names
 */
export function getInstalledUplayGamePaths(): string[] {
  try {
    return getUplayInstalledGames().map((game) => path.basename(game.installDir));
  } catch (error) {
    console.error('[Uplay] Error getting game paths:', error);
    return [];
  }
}

/**
 * Get Ubisoft Connect install id by game path (used for uplay:// launch)
 */
export function getUplayGameId(gamePath: string): string | null {
  const resolvedTarget = path.resolve(gamePath);
  for (const game of getUplayInstalledGames()) {
    if (path.resolve(game.installDir) === resolvedTarget) {
      return game.installId;
    }
  }
  return null;
}
