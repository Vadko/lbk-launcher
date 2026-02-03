/**
 * GOG Galaxy Detection
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { isLinux, isMacOS, isWindows } from '../utils/platform';

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
  // Linux (Heroic) support
  if (isLinux()) {
    const home = os.homedir();
    const heroicPaths = [
      path.join(home, 'Games/Heroic'),
      path.join(home, '.var/app/com.heroicgameslauncher.hgl/Games/Heroic'),
    ];

    // Check directories
    for (const heroicPath of heroicPaths) {
      if (fs.existsSync(heroicPath)) {
        const gamePath = path.join(heroicPath, gameFolderName);
        if (fs.existsSync(gamePath)) {
          console.log(`[GOG] ✓ Game found (Heroic): ${gamePath}`);
          return gamePath;
        }
      }
    }

    // Try parsing installed.json
    try {
      const configPath = path.join(
        home,
        '.var/app/com.heroicgameslauncher.hgl/config/heroic/gog_store/installed.json'
      );
      if (fs.existsSync(configPath)) {
        const content = fs.readFileSync(configPath, 'utf8');
        const games = JSON.parse(content);
        // Heroic GOG installed.json is usually an array of objects with install_path
        if (Array.isArray(games)) {
          const game = games.find((g: any) => {
            const installPath = g.install_path;
            if (installPath) {
              return path.basename(installPath) === gameFolderName;
            }
            return false;
          });

          if (game && fs.existsSync(game.install_path)) {
            console.log(`[GOG] ✓ Game found via installed.json: ${game.install_path}`);
            return game.install_path;
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
      const home = os.homedir();
      const heroicPaths = [
        path.join(home, 'Games/Heroic'),
        path.join(home, '.var/app/com.heroicgameslauncher.hgl/Games/Heroic'),
      ];

      for (const heroicPath of heroicPaths) {
        if (fs.existsSync(heroicPath)) {
          try {
            const gogGames = fs.readdirSync(heroicPath);
            for (const game of gogGames) {
              const gamePath = path.join(heroicPath, game);
              if (fs.statSync(gamePath).isDirectory()) {
                paths.push(game);
              }
            }
          } catch (e) {
            console.warn(`[GOG] Error reading Heroic path ${heroicPath}:`, e);
          }
        }
      }

      // Read from installed.json as well
      try {
        const configPath = path.join(
          home,
          '.var/app/com.heroicgameslauncher.hgl/config/heroic/gog_store/installed.json'
        );
        if (fs.existsSync(configPath)) {
          const content = fs.readFileSync(configPath, 'utf8');
          const games = JSON.parse(content);
          if (Array.isArray(games)) {
            for (const game of games) {
              if (game.install_path && fs.existsSync(game.install_path)) {
                paths.push(path.basename(game.install_path));
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
export function getHeroicGogLibrary(): string[] {
  if (!isLinux()) return [];

  const home = os.homedir();
  const configPath = path.join(
    home,
    '.var/app/com.heroicgameslauncher.hgl/config/heroic/store_cache/gog_library.json'
  );

  const titles: string[] = [];

  try {
    if (fs.existsSync(configPath)) {
      const content = fs.readFileSync(configPath, 'utf8');
      const data = JSON.parse(content);

      // GOG library structure: { games: [...] }
      const games = Array.isArray(data) ? data : data.games || [];

      if (Array.isArray(games)) {
        for (const game of games) {
          if (game.title) {
            titles.push(game.title);
          }
        }
      }
    }
  } catch (error) {
    console.error('[GOG] Error reading Heroic library:', error);
  }

  return titles;
}
