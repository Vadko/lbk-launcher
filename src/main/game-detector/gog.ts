/**
 * GOG Galaxy Detection
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { isLinux, isMacOS, isWindows } from '../utils/platform';
import {
  findGameInHeroicDirs,
  getAllHeroicGameFolders,
  getHeroicConfigPaths,
} from './heroic';

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

interface HeroicGogGame {
  install_path?: string;
  title?: string;
  [key: string]: unknown;
}

/**
 * Find GOG game by folder name
 */
export function findGOGGame(gameFolderName: string): string | null {
  // Linux (Heroic) support
  if (isLinux()) {
    // Check Heroic directories
    const heroicPath = findGameInHeroicDirs(gameFolderName);
    if (heroicPath) {
      console.log(`[GOG] ✓ Game found (Heroic): ${heroicPath}`);
      return heroicPath;
    }

    // Try parsing installed.json
    try {
      const configPaths = getHeroicConfigPaths().map((p) =>
        path.join(p, 'gog_store/installed.json')
      );

      for (const configPath of configPaths) {
        if (fs.existsSync(configPath)) {
          const content = fs.readFileSync(configPath, 'utf8');
          const games = JSON.parse(content);
          // Heroic GOG installed.json is usually an array of objects with install_path
          if (Array.isArray(games)) {
            const game = games.find((g: HeroicGogGame) => {
              const installPath = g.install_path;
              if (installPath) {
                return path.basename(installPath) === gameFolderName;
              }
              return false;
            });

            if (game && game.install_path && fs.existsSync(game.install_path)) {
              console.log(`[GOG] ✓ Game found via installed.json: ${game.install_path}`);
              return game.install_path;
            }
          }
        }
      }
    } catch (e) {
      console.warn('[GOG] Error checking Heroic config:', e);
    }
  }

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
    // Linux (Heroic) support
    if (isLinux()) {
      // Get all game folders from Heroic directories
      paths.push(...getAllHeroicGameFolders());

      // Read from installed.json as well
      try {
        const configPaths = getHeroicConfigPaths().map((p) =>
          path.join(p, 'gog_store/installed.json')
        );

        for (const configPath of configPaths) {
          if (fs.existsSync(configPath)) {
            const content = fs.readFileSync(configPath, 'utf8');
            const games = JSON.parse(content);
            if (Array.isArray(games)) {
              for (const game of games as HeroicGogGame[]) {
                if (game.install_path && fs.existsSync(game.install_path)) {
                  paths.push(path.basename(game.install_path));
                }
              }
            }
          }
        }
      } catch (e) {
        console.warn('[GOG] Error reading Heroic config:', e);
      }
    }

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

/**
 * Get all GOG games from Heroic library (owned games)
 * Returns array of game titles
 */
export function getGogLibrary(): string[] {
  if (!isLinux()) return [];

  const configPaths = getHeroicConfigPaths().map((p) =>
    path.join(p, 'store_cache/gog_library.json')
  );

  const titles: string[] = [];

  try {
    for (const configPath of configPaths) {
      if (fs.existsSync(configPath)) {
        const content = fs.readFileSync(configPath, 'utf8');
        const data = JSON.parse(content);

        // GOG library structure: { games: [...] }
        const games = Array.isArray(data) ? data : data.games || [];

        if (Array.isArray(games)) {
          for (const game of games as HeroicGogGame[]) {
            if (game.title) {
              titles.push(game.title);
            }
          }
        }
      }
    }
  } catch (error) {
    console.error('[GOG] Error reading Heroic library:', error);
  }

  return titles;
}
