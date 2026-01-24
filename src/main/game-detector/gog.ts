/**
 * GOG Galaxy Detection
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { isMacOS, isWindows } from '../utils/platform';

/**
 * Detect GOG Galaxy installation path
 */
function getGOGPath(): string | null {
  try {
    if (isWindows()) {
      try {
        const output = execSync(
          'reg query "HKEY_LOCAL_MACHINE\\SOFTWARE\\WOW6432Node\\GOG.com\\GalaxyClient\\paths" /v client',
          { encoding: 'utf8' }
        );
        const match = output.match(/client\s+REG_SZ\s+(.+)/);
        if (match?.[1]) {
          return path.dirname(match[1].trim());
        }
      } catch {
        const defaultPath = 'C:\\Program Files (x86)\\GOG Galaxy\\Games';
        if (fs.existsSync(defaultPath)) {
          return defaultPath;
        }
      }
    } else if (isMacOS()) {
      const gogAppPath = '/Applications/GOG Galaxy.app';
      if (fs.existsSync(gogAppPath)) {
        const gamesPath = path.join(
          os.homedir(),
          'Library/Application Support/GOG.com/Galaxy/Storage/galaxy-2.0/installed'
        );
        if (fs.existsSync(gamesPath)) {
          return gamesPath;
        }

        const fallbackPath = path.join(os.homedir(), 'GOG Games');
        if (fs.existsSync(fallbackPath)) {
          return fallbackPath;
        }
      }
    }
  } catch (error) {
    console.error('[GOG] Error detecting path:', error);
  }

  return null;
}

/**
 * Find GOG game by folder name
 */
export function findGOGGame(gameFolderName: string): string | null {
  const gogPath = getGOGPath();
  if (!gogPath) return null;

  const gamePath = path.join(gogPath, gameFolderName);
  if (fs.existsSync(gamePath)) {
    console.log(`[GOG] ✓ Game found: ${gamePath}`);
    return gamePath;
  }

  return null;
}

/**
 * Get all installed GOG game paths
 */
export function getInstalledGOGGamePaths(): string[] {
  const paths: string[] = [];

  try {
    const gogPath = getGOGPath();
    if (gogPath && fs.existsSync(gogPath)) {
      const gogGames = fs.readdirSync(gogPath);
      for (const game of gogGames) {
        const gamePath = path.join(gogPath, game);
        if (fs.statSync(gamePath).isDirectory()) {
          paths.push(game);
        }
      }
    }
  } catch (error) {
    console.error('[GOG] Error getting game paths:', error);
  }

  return paths;
}
