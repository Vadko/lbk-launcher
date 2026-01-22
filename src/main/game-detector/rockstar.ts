/**
 * Rockstar Games Launcher Detection
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { isMacOS, isWindows } from '../utils/platform';

/**
 * Detect Rockstar Games Launcher installation path
 */
function getRockstarPath(): string | null {
  try {
    if (isWindows()) {
      const localAppData =
        process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
      const launcherSettingsPath = path.join(
        localAppData,
        'Rockstar Games',
        'Launcher',
        'settings_user.dat'
      );

      if (fs.existsSync(launcherSettingsPath)) {
        console.log('[Rockstar] Launcher settings found at:', launcherSettingsPath);
        return path.dirname(launcherSettingsPath);
      }

      const programFiles = process.env['PROGRAMFILES'] || 'C:\\Program Files';
      const programFilesX86 =
        process.env['PROGRAMFILES(X86)'] || 'C:\\Program Files (x86)';

      const launcherPaths = [
        path.join(programFiles, 'Rockstar Games', 'Launcher'),
        path.join(programFilesX86, 'Rockstar Games', 'Launcher'),
      ];

      for (const launcherPath of launcherPaths) {
        if (fs.existsSync(launcherPath)) {
          console.log('[Rockstar] Launcher found at:', launcherPath);
          return launcherPath;
        }
      }
    } else if (isMacOS()) {
      const macPath = path.join(
        os.homedir(),
        'Library',
        'Application Support',
        'Rockstar Games'
      );
      if (fs.existsSync(macPath)) {
        console.log('[Rockstar] Found at:', macPath);
        return macPath;
      }
    }
  } catch (error) {
    console.error('[Rockstar] Error detecting path:', error);
  }

  console.warn('[Rockstar] Rockstar Games Launcher not found');
  return null;
}

/**
 * Get Rockstar Games installation directories from registry
 */
function getRockstarGamePaths(): Map<string, string> {
  const games = new Map<string, string>();

  if (!isWindows()) {
    return games;
  }

  try {
    const regPath = path.join(
      process.env.SystemRoot || 'C:\\Windows',
      'System32',
      'reg.exe'
    );

    const rockstarGames = [
      { key: 'Grand Theft Auto V', registry: 'Grand Theft Auto V' },
      { key: 'Red Dead Redemption 2', registry: 'Red Dead Redemption 2' },
      { key: 'Grand Theft Auto IV', registry: 'Grand Theft Auto IV' },
      { key: 'Max Payne 3', registry: 'Max Payne 3' },
      { key: 'L.A. Noire', registry: 'L.A. Noire' },
      { key: 'GTA San Andreas', registry: 'Grand Theft Auto San Andreas' },
    ];

    for (const game of rockstarGames) {
      try {
        const output = execSync(
          `"${regPath}" query "HKEY_LOCAL_MACHINE\\SOFTWARE\\WOW6432Node\\Rockstar Games\\${game.registry}" /v InstallFolder`,
          { encoding: 'utf8', timeout: 5000 }
        );
        const match = output.match(/InstallFolder\s+REG_SZ\s+(.+)/);
        if (match?.[1]) {
          const installPath = match[1].trim();
          if (fs.existsSync(installPath)) {
            const folderName = path.basename(installPath);
            games.set(folderName.toLowerCase(), installPath);
            console.log(`[Rockstar] Game found: ${game.key} at ${installPath}`);
          }
        }
      } catch {
        try {
          const output = execSync(
            `"${regPath}" query "HKEY_LOCAL_MACHINE\\SOFTWARE\\Rockstar Games\\${game.registry}" /v InstallFolder`,
            { encoding: 'utf8', timeout: 5000 }
          );
          const match = output.match(/InstallFolder\s+REG_SZ\s+(.+)/);
          if (match?.[1]) {
            const installPath = match[1].trim();
            if (fs.existsSync(installPath)) {
              const folderName = path.basename(installPath);
              games.set(folderName.toLowerCase(), installPath);
              console.log(
                `[Rockstar] Game found (32-bit): ${game.key} at ${installPath}`
              );
            }
          }
        } catch {
          // Game not found
        }
      }
    }

    // Scan default Rockstar Games folders
    const defaultPaths = [
      'C:\\Program Files\\Rockstar Games',
      'C:\\Program Files (x86)\\Rockstar Games',
      path.join(process.env['PROGRAMFILES'] || 'C:\\Program Files', 'Rockstar Games'),
      path.join(
        process.env['PROGRAMFILES(X86)'] || 'C:\\Program Files (x86)',
        'Rockstar Games'
      ),
    ];

    for (const basePath of defaultPaths) {
      if (fs.existsSync(basePath)) {
        try {
          const entries = fs.readdirSync(basePath, { withFileTypes: true });
          for (const entry of entries) {
            if (
              entry.isDirectory() &&
              entry.name !== 'Launcher' &&
              entry.name !== 'Social Club'
            ) {
              const gamePath = path.join(basePath, entry.name);
              if (!games.has(entry.name.toLowerCase())) {
                games.set(entry.name.toLowerCase(), gamePath);
                console.log(
                  `[Rockstar] Game found in folder: ${entry.name} at ${gamePath}`
                );
              }
            }
          }
        } catch (err) {
          console.error(`[Rockstar] Error reading folder ${basePath}:`, err);
        }
      }
    }
  } catch (error) {
    console.error('[Rockstar] Error getting game paths:', error);
  }

  return games;
}

/**
 * Find Rockstar game by folder name
 */
export function findRockstarGame(gameFolderName: string): string | null {
  console.log(`[Rockstar] Searching for game: "${gameFolderName}"`);

  getRockstarPath(); // Just for logging

  const rockstarGames = getRockstarGamePaths();

  // Try exact match
  const gamePath = rockstarGames.get(gameFolderName.toLowerCase());
  if (gamePath && fs.existsSync(gamePath)) {
    console.log(`[Rockstar] ✓ Game found: ${gameFolderName} at ${gamePath}`);
    return gamePath;
  }

  // Try partial match
  for (const [folderName, fullPath] of rockstarGames.entries()) {
    if (
      folderName.includes(gameFolderName.toLowerCase()) ||
      gameFolderName.toLowerCase().includes(folderName)
    ) {
      if (fs.existsSync(fullPath)) {
        console.log(
          `[Rockstar] ✓ Game found (partial match): ${gameFolderName} -> ${fullPath}`
        );
        return fullPath;
      }
    }
  }

  console.warn(`[Rockstar] ✗ Game "${gameFolderName}" not found`);
  return null;
}

/**
 * Get all installed Rockstar game paths
 */
export function getInstalledRockstarGamePaths(): string[] {
  const paths: string[] = [];

  try {
    const rockstarGames = getRockstarGamePaths();
    for (const [folderName] of rockstarGames.entries()) {
      paths.push(folderName);
    }
  } catch (error) {
    console.error('[Rockstar] Error getting game paths:', error);
  }

  return paths;
}
