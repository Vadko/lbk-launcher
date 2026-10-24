/**
 * EA App (EA Desktop) Detection
 *
 * EA / Origin games register their install directory in the Windows registry
 * under the "Electronic Arts" / "Origin Games" trees with an `Install Dir`
 * value. This is the method EA's own tooling docs recommend as the alternative
 * to decrypting the hardware-locked `IS` file (which is unrecoverable after a
 * GPU/CPU/board/disk change — see GameFinder wiki). A relaxed folder scan of
 * the EA library dirs covers games that didn't write a registry entry.
 */

import * as fs from 'fs';
import * as path from 'path';
import { enumerateKeysSafe, HKEY } from 'registry-js';
import { isWindows } from '../utils/platform';
import { getRegistryString } from '../utils/registry';
import { logIfChanged } from './log-if-changed';

interface EAInstalledGame {
  installDir: string;
}

// Games sit at any depth, e.g. both Electronic Arts\{Game} and Electronic Arts\Electronic Arts\{Game}
function findInstallDirs(key: string): string[] {
  const installDir = getRegistryString(HKEY.HKEY_LOCAL_MACHINE, key, 'Install Dir');
  return [
    ...(installDir ? [installDir] : []),
    ...enumerateKeysSafe(HKEY.HKEY_LOCAL_MACHINE, key).flatMap((subkey) =>
      findInstallDirs(`${key}\\${subkey}`)
    ),
  ];
}

/** `Install Dir` values from the EA/Origin registry trees, deduped by resolved path. */
function getGamesFromRegistry(): EAInstalledGame[] {
  const registryKeys = [
    'SOFTWARE\\WOW6432Node\\Electronic Arts',
    'SOFTWARE\\Electronic Arts',
    'SOFTWARE\\WOW6432Node\\Origin Games',
    'SOFTWARE\\Origin Games',
  ];

  const byResolved = new Map<string, string>();
  for (const value of registryKeys.flatMap(findInstallDirs)) {
    const installDir = value.trim().replace(/[\\/]+$/, '');
    if (installDir && fs.existsSync(installDir)) {
      byResolved.set(path.resolve(installDir).toLowerCase(), installDir);
    }
  }

  return Array.from(byResolved.values()).map((installDir) => ({ installDir }));
}

/** EA library base dirs: user-chosen (machine.ini) + common defaults. */
function getEALibraryDirs(): string[] {
  const dirs = new Set<string>();

  const programFiles = process.env['PROGRAMFILES'] || 'C:\\Program Files';
  const programFilesX86 = process.env['PROGRAMFILES(X86)'] || 'C:\\Program Files (x86)';
  dirs.add(path.join(programFiles, 'EA Games'));
  dirs.add(path.join(programFilesX86, 'EA Games'));
  dirs.add(path.join(programFiles, 'Origin Games'));
  dirs.add(path.join(programFilesX86, 'Origin Games'));

  // User-chosen install location from EA Desktop settings
  try {
    const programData = process.env.PROGRAMDATA || 'C:\\ProgramData';
    const machineIniPath = path.join(programData, 'EA Desktop', 'machine.ini');
    if (fs.existsSync(machineIniPath)) {
      const content = fs.readFileSync(machineIniPath, 'utf8');
      const match = content.match(/^machine\.downloadinplacedir=(.+)$/m);
      if (match?.[1]) {
        dirs.add(match[1].trim().replace(/[\\/]+$/, ''));
      }
    }
  } catch {
    // Safe to ignore
  }

  return Array.from(dirs);
}

/**
 * Fallback: every immediate subfolder of an EA library dir is a candidate
 * game (mirrors how GOG/Rockstar list folder names). Catches games missing a
 * registry entry.
 */
function getGamesFromFolderScan(): EAInstalledGame[] {
  const games: EAInstalledGame[] = [];

  for (const baseDir of getEALibraryDirs()) {
    if (!fs.existsSync(baseDir)) {
      continue;
    }
    try {
      for (const entry of fs.readdirSync(baseDir, { withFileTypes: true })) {
        if (entry.isDirectory()) {
          games.push({ installDir: path.join(baseDir, entry.name) });
        }
      }
    } catch {
      // Safe to ignore
    }
  }

  return games;
}

function getEAInstalledGames(): EAInstalledGame[] {
  if (!isWindows()) {
    return [];
  }

  // Registry gives absolute paths (incl. custom install dirs); folder scan
  // covers games without a registry entry. Merge and dedupe by resolved path.
  const byResolved = new Map<string, string>();
  for (const game of [...getGamesFromRegistry(), ...getGamesFromFolderScan()]) {
    byResolved.set(path.resolve(game.installDir).toLowerCase(), game.installDir);
  }

  const games = Array.from(byResolved.values()).map((installDir) => ({ installDir }));
  if (games.length > 0) {
    logIfChanged(
      'ea-installed',
      `[EA] Found ${games.length} installed games: ${games.map((g) => path.basename(g.installDir)).join(', ')}`
    );
  }
  return games;
}

/**
 * Find EA App game by folder name
 */
export function findEAGame(gameFolderName: string): string | null {
  console.log(`[EA] Searching for game: "${gameFolderName}"`);

  const target = gameFolderName.toLowerCase();
  for (const game of getEAInstalledGames()) {
    if (path.basename(game.installDir).toLowerCase() === target) {
      console.log(`[EA] ✓ Game found: ${game.installDir}`);
      return game.installDir;
    }
  }

  console.warn(`[EA] ✗ Game "${gameFolderName}" not found`);
  return null;
}

/**
 * Get all installed EA App game folder names
 */
export function getInstalledEAGamePaths(): string[] {
  try {
    return getEAInstalledGames().map((game) => path.basename(game.installDir));
  } catch (error) {
    console.error('[EA] Error getting game paths:', error);
    return [];
  }
}
