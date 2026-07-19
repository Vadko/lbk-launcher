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

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { isWindows } from '../utils/platform';

interface EAInstalledGame {
  installDir: string;
}

/**
 * Read `Install Dir` values from the EA/Origin registry trees.
 * `reg query ... /s /v "Install Dir"` returns only subkeys that have that
 * value, so the client keys (EA Core, EA Desktop, EADM) are skipped
 * automatically. Games appear under both `Electronic Arts\{Game}` and the
 * nested `Electronic Arts\Electronic Arts\{Game}` — deduped by resolved path.
 */
function getGamesFromRegistry(): EAInstalledGame[] {
  const regPath = path.join(
    process.env.SystemRoot || 'C:\\Windows',
    'System32',
    'reg.exe'
  );
  const registryKeys = [
    'HKEY_LOCAL_MACHINE\\SOFTWARE\\WOW6432Node\\Electronic Arts',
    'HKEY_LOCAL_MACHINE\\SOFTWARE\\Electronic Arts',
    'HKEY_LOCAL_MACHINE\\SOFTWARE\\WOW6432Node\\Origin Games',
    'HKEY_LOCAL_MACHINE\\SOFTWARE\\Origin Games',
  ];

  const byResolved = new Map<string, string>();

  for (const registryKey of registryKeys) {
    try {
      const output = execSync(`"${regPath}" query "${registryKey}" /s /v "Install Dir"`, {
        encoding: 'utf8',
        timeout: 5000,
        stdio: ['pipe', 'pipe', 'ignore'],
      });

      for (const rawLine of output.split(/\r?\n/)) {
        const match = rawLine.match(/Install Dir\s+REG_SZ\s+(.+)$/);
        if (match?.[1]) {
          const installDir = match[1].trim().replace(/[\\/]+$/, '');
          if (installDir && fs.existsSync(installDir)) {
            byResolved.set(path.resolve(installDir).toLowerCase(), installDir);
          }
        }
      }
    } catch {
      // Key missing on this machine — try the next one
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
    console.log(`[EA] Found ${games.length} installed games`);
    console.log(
      `[EA] Games list: ${games.map((g) => path.basename(g.installDir)).join(', ')}`
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
