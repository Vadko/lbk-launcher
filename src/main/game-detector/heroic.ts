/**
 * Heroic Games Launcher utilities (GOG + Epic on Linux)
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { isLinux } from '../utils/platform';

/**
 * Get Heroic game installation paths (native + Flatpak)
 */
export function getHeroicGamePaths(): string[] {
  if (!isLinux()) return [];

  const home = os.homedir();
  return [
    path.join(home, 'Games/Heroic'),
    path.join(home, '.var/app/com.heroicgameslauncher.hgl/Games/Heroic'),
  ];
}

/**
 * Get Heroic config paths (native + Flatpak)
 */
export function getHeroicConfigPaths(): string[] {
  if (!isLinux()) return [];

  const home = os.homedir();
  return [
    path.join(home, '.config/heroic'),
    path.join(home, '.var/app/com.heroicgameslauncher.hgl/config/heroic'),
  ];
}

/**
 * Find a game in Heroic directories by folder name
 */
export function findGameInHeroicDirs(gameFolderName: string): string | null {
  for (const heroicPath of getHeroicGamePaths()) {
    if (fs.existsSync(heroicPath)) {
      const gamePath = path.join(heroicPath, gameFolderName);
      if (fs.existsSync(gamePath)) {
        return gamePath;
      }
    }
  }
  return null;
}

/**
 * Get all game folder names from Heroic directories
 */
export function getAllHeroicGameFolders(): string[] {
  const folders: string[] = [];

  for (const heroicPath of getHeroicGamePaths()) {
    if (fs.existsSync(heroicPath)) {
      try {
        const games = fs.readdirSync(heroicPath);
        for (const game of games) {
          const gamePath = path.join(heroicPath, game);
          if (fs.statSync(gamePath).isDirectory()) {
            folders.push(game);
          }
        }
      } catch (e) {
        console.warn(`[Heroic] Error reading path ${heroicPath}:`, e);
      }
    }
  }

  return folders;
}
