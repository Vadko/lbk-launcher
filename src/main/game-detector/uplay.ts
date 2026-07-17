/**
 * Ubisoft Connect (Uplay) Detection
 *
 * Ported from Playnite's UplayLibrary (MIT):
 * https://github.com/JosefNemec/PlayniteExtensions — source/Libraries/UplayLibrary
 * Installed games live in the registry under Ubisoft\Launcher\Installs\{id}
 * with an InstallDir value (forward slashes).
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { isWindows } from '../utils/platform';

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

  const regPath = path.join(
    process.env.SystemRoot || 'C:\\Windows',
    'System32',
    'reg.exe'
  );
  const registryKeys = [
    'HKEY_LOCAL_MACHINE\\SOFTWARE\\WOW6432Node\\Ubisoft\\Launcher\\Installs',
    'HKEY_LOCAL_MACHINE\\SOFTWARE\\Ubisoft\\Launcher\\Installs',
  ];

  for (const registryKey of registryKeys) {
    try {
      const output = execSync(`"${regPath}" query "${registryKey}" /s /v InstallDir`, {
        encoding: 'utf8',
        timeout: 5000,
        stdio: ['pipe', 'pipe', 'ignore'],
      });

      const games: UplayInstalledGame[] = [];
      let currentInstallId: string | null = null;

      for (const rawLine of output.split(/\r?\n/)) {
        const line = rawLine.trim();
        if (rawLine.startsWith('HKEY_LOCAL_MACHINE')) {
          currentInstallId = rawLine.trim().split('\\').pop() || null;
          continue;
        }
        const match = line.match(/^InstallDir\s+REG_SZ\s+(.+)$/);
        if (match?.[1] && currentInstallId) {
          // Registry stores forward slashes — normalize like Playnite does
          const installDir = match[1]
            .trim()
            .replace(/\//g, path.sep)
            .replace(/[\\/]+$/, '');
          if (installDir && fs.existsSync(installDir)) {
            games.push({ installId: currentInstallId, installDir });
          }
        }
      }

      if (games.length > 0) {
        console.log(`[Uplay] Found ${games.length} installed games in registry`);
        console.log(
          `[Uplay] Games list: ${games.map((g) => path.basename(g.installDir)).join(', ')}`
        );
        return games;
      }
    } catch {
      // Key missing (Ubisoft Connect not installed) — try the next view
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
