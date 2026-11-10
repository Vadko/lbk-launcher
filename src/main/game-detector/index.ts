/**
 * Game Detector - Main Entry Point
 * Detects installed games from various platforms (Steam, Epic, GOG, Rockstar, Xbox)
 */

import { G } from '@mobily/ts-belt';
import type { DetectedGame, InstallPath } from '../../shared/types';
import { fetchGames } from '../api';
import { normalizeInstalledFolder } from '../utils/install-path';
import { winePrefixOf } from '../wine/dos-path';
import { winePrefixRefOf } from '../wine/prefixes';
import { findEAGame } from './ea';
import { findEpicGame, getHeroicEpicAppName } from './epic';
import { findGOGGame, getHeroicGOGId } from './gog';
import { logIfChanged } from './log-if-changed';
import { findRockstarGame } from './rockstar';
import {
  findSteamGameCopies,
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

function toGamePath(platform: GamePath['platform'], foundPath: string | null): GamePath {
  const wine = foundPath ? winePrefixRefOf(foundPath) : null;
  return {
    platform,
    path: foundPath || '',
    exists: !!foundPath,
    ...(wine ? { wine } : {}),
  };
}

function findStoreGame(
  type: NonNullable<InstallPath['type']>,
  folder: string
): string | null {
  switch (type) {
    case 'gog':
      return findGOGGame(folder);
    case 'epic':
      return findEpicGame(folder);
    case 'rockstar':
      return findRockstarGame(folder);
    case 'xbox':
      return findXboxGame(folder);
    case 'uplay':
      return findUplayGame(folder);
    case 'ea':
      return findEAGame(folder);
    case 'steam':
    case 'emulator':
    case 'other':
      return null;
  }
}

/** Every copy of the game one install path finds: Steam's in each Steam root, native first. */
function detectGameCopies(
  installPath: InstallPath | null | undefined,
  steamAppId?: number | null,
  winePrefix?: string | null
): GamePath[] {
  if (!installPath || !installPath.type) {
    return [];
  }

  switch (installPath.type) {
    case 'steam': {
      if (!installPath.path && G.isNullable(steamAppId)) {
        return [];
      }
      const copies = findSteamGameCopies(installPath.path, steamAppId, winePrefix);
      return copies.length > 0
        ? copies.map((copy) => toGamePath('steam', copy.path))
        : [toGamePath('steam', null)];
    }

    case 'emulator':
    case 'other':
      // These platforms require manual path selection
      return installPath.path ? [toGamePath(installPath.type, null)] : [];

    case 'gog':
    case 'epic':
    case 'rockstar':
    case 'xbox':
    case 'uplay':
    case 'ea': {
      if (!installPath.path) {
        return [];
      }
      const found = findStoreGame(installPath.type, installPath.path);
      const wanted =
        winePrefix === undefined ||
        (found !== null && winePrefixOf(found) === winePrefix);
      return [toGamePath(installPath.type, wanted ? found : null)];
    }
  }

  return [];
}

export function detectGamePath(
  installPath: InstallPath | null | undefined,
  steamAppId?: number | null,
  winePrefix?: string | null
): GamePath | null {
  return detectGameCopies(installPath, steamAppId, winePrefix)[0] ?? null;
}

/**
 * Detect all possible paths for a game
 */
export function detectGamePaths(
  installPaths: InstallPath[],
  steamAppId?: number | null
): GamePath[] {
  return installPaths.flatMap((installPath) => detectGameCopies(installPath, steamAppId));
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
