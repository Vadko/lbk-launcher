/**
 * Game Detector - Main Entry Point
 * Detects installed games from various platforms (Steam, Epic, GOG, Rockstar, Xbox)
 */

import { G } from '@mobily/ts-belt';
import type { DetectedGame, InstallPath } from '../../shared/types';
import { fetchGames } from '../api';
import { normalizeInstalledFolder } from '../utils/install-path';
import { findEAGame } from './ea';
import { findEpicGame, getHeroicEpicAppName } from './epic';
import { findGOGGame, getHeroicGOGId } from './gog';
import { logIfChanged } from './log-if-changed';
import { findRockstarGame } from './rockstar';
import {
  findSteamGame,
  getInstalledSteamGamePaths,
  getInstalledSteamGames,
} from './steam';
import {
  getInstalledEpicGamePathsCached,
  getInstalledGOGGamePathsCached,
  getInstalledRegistryGamePaths,
  getInstalledXboxGamePaths,
} from './store-cache';
import type { GamePath } from './types'; // Used locally
import { findUplayGame } from './uplay';
import { findXboxGame } from './xbox';

// ============================================================================
// Main Detection Logic
// ============================================================================

export function detectGamePath(
  installPath: InstallPath | null | undefined,
  steamAppId?: number | null
): GamePath | null {
  if (!installPath || !installPath.type) {
    return null;
  }

  let foundPath: string | null = null;

  switch (installPath.type) {
    case 'steam':
      if (!installPath.path && G.isNullable(steamAppId)) {
        return null;
      }
      foundPath = findSteamGame(installPath.path, steamAppId);
      return {
        platform: 'steam',
        path: foundPath || '',
        exists: !!foundPath,
      };

    case 'gog':
      if (!installPath.path) {
        return null;
      }
      foundPath = findGOGGame(installPath.path);
      return {
        platform: 'gog',
        path: foundPath || '',
        exists: !!foundPath,
      };

    case 'epic':
      if (!installPath.path) {
        return null;
      }
      foundPath = findEpicGame(installPath.path);
      return {
        platform: 'epic',
        path: foundPath || '',
        exists: !!foundPath,
      };

    case 'rockstar':
      if (!installPath.path) {
        return null;
      }
      foundPath = findRockstarGame(installPath.path);
      return {
        platform: 'rockstar',
        path: foundPath || '',
        exists: !!foundPath,
      };

    case 'xbox':
      if (!installPath.path) {
        return null;
      }
      foundPath = findXboxGame(installPath.path);
      return {
        platform: 'xbox',
        path: foundPath || '',
        exists: !!foundPath,
      };

    case 'uplay':
      if (!installPath.path) {
        return null;
      }
      foundPath = findUplayGame(installPath.path);
      return {
        platform: 'uplay',
        path: foundPath || '',
        exists: !!foundPath,
      };

    case 'ea':
      if (!installPath.path) {
        return null;
      }
      foundPath = findEAGame(installPath.path);
      return {
        platform: 'ea',
        path: foundPath || '',
        exists: !!foundPath,
      };

    case 'emulator':
    case 'other':
      if (!installPath.path) {
        return null;
      }
      // These platforms require manual path selection
      return {
        platform: installPath.type,
        path: '',
        exists: false,
      };
  }

  return null;
}

/**
 * Detect all possible paths for a game
 */
export function detectGamePaths(
  installPaths: InstallPath[],
  steamAppId?: number | null
): GamePath[] {
  const results: GamePath[] = [];

  for (const installPath of installPaths) {
    const gamePath = detectGamePath(installPath, steamAppId);
    if (gamePath) {
      results.push(gamePath);
    }
  }

  return results;
}

/**
 * Get the first available game path
 */
export function getFirstAvailableGamePath(
  installPaths: InstallPath[],
  steamAppId?: number | null
): GamePath | null {
  const paths = detectGamePaths(installPaths, steamAppId);
  return paths.find((p) => p.exists) || null;
}

/**
 * Get all installed games on the system (all platforms)
 * Returns a list of install paths that can be matched against database
 */
export function getAllInstalledGamePaths(): string[] {
  const installedPaths: string[] = [];

  // Steam games
  try {
    installedPaths.push(...getInstalledSteamGamePaths());
  } catch (error) {
    console.error('[GameDetector] Error getting Steam games:', error);
  }

  // GOG games
  try {
    installedPaths.push(...getInstalledGOGGamePathsCached());
  } catch (error) {
    console.error('[GameDetector] Error getting GOG games:', error);
  }

  // Epic games
  try {
    installedPaths.push(...getInstalledEpicGamePathsCached());
  } catch (error) {
    console.error('[GameDetector] Error getting Epic games:', error);
  }

  // Xbox games
  try {
    installedPaths.push(...getInstalledXboxGamePaths());
  } catch (error) {
    console.error('[GameDetector] Error getting Xbox games:', error);
  }

  // Rockstar, Ubisoft Connect and EA App games (registry-backed)
  installedPaths.push(...getInstalledRegistryGamePaths());

  logIfChanged(
    'installed-paths',
    `[GameDetector] Found ${installedPaths.length} installed game paths on system`
  );
  return installedPaths;
}

/**
 * Which catalog games are installed on this system: Steam by app id first
 * (immune to installdir/folder drift), then installdir; other platforms by
 * folder name. One cached pass; a bad row is skipped, never fatal.
 */
export function getDetectedGames(): DetectedGame[] {
  const { games } = fetchGames();
  const { byFolder: steamByFolder, byAppId: steamByAppId } = getInstalledSteamGames();

  const installedFolders = new Set<string>();
  for (const p of getAllInstalledGamePaths()) {
    const folder = p
      .replace(/[\\/]$/, '')
      .split(/[\\/]/)
      .pop();
    if (folder) {
      installedFolders.add(folder.toLowerCase());
    }
  }

  const detected: DetectedGame[] = [];

  for (const game of games) {
    try {
      // Steam app id — authoritative primary
      if (game.steam_app_id != null) {
        const steamPath = steamByAppId.get(game.steam_app_id);
        if (steamPath) {
          detected.push({ gameId: game.id, platform: 'steam', path: steamPath });
          continue;
        }
      }

      if (!Array.isArray(game.install_paths)) {
        continue;
      }

      // Fallback — installdir (Steam) / folder name (other platforms)
      for (const installPath of game.install_paths) {
        if (!installPath?.path) {
          continue;
        }
        const folder = normalizeInstalledFolder(installPath.path);

        if (installPath.type === 'steam') {
          const steamPath = steamByFolder.get(folder);
          if (steamPath) {
            detected.push({ gameId: game.id, platform: 'steam', path: steamPath });
            break;
          }
        }
        if (installedFolders.has(folder)) {
          detected.push({
            gameId: game.id,
            platform: installPath.type ?? 'other',
            path: installPath.path,
          });
          break;
        }
      }
    } catch (error) {
      console.error(`[GameDetector] Failed to check game ${game.id}:`, error);
    }
  }

  console.log(`[GameDetector] Detected ${detected.length} installed catalog games`);
  return detected;
}

interface HeroicGameInfo {
  appName: string;
  runner: 'gog' | 'legendary';
}

export function getHeroicGame(gamePath: string): HeroicGameInfo | null {
  const gogId = getHeroicGOGId(gamePath);
  if (gogId) {
    return { appName: gogId, runner: 'gog' };
  }

  const epicAppName = getHeroicEpicAppName(gamePath);
  if (epicAppName) {
    return { appName: epicAppName, runner: 'legendary' };
  }

  return null;
}
