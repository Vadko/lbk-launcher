/**
 * Game Detector - Main Entry Point
 * Detects installed games from various platforms (Steam, Epic, GOG, Rockstar, Xbox)
 */

import type { InstallPath } from '../../shared/types';
import { findEpicGame, getHeroicEpicAppName, getInstalledEpicGamePaths } from './epic';
import { findGOGGame, getHeroicGOGId, getInstalledGOGGamePaths } from './gog';
import { findRockstarGame, getInstalledRockstarGamePaths } from './rockstar';
import { findSteamGame, getInstalledSteamGamePaths } from './steam';
import type { GamePath } from './types'; // Used locally
import { findXboxGame, getInstalledXboxGamePaths } from './xbox';

// ============================================================================
// Re-exports
// ============================================================================

// Epic
export { getEpicAppName } from './epic';
// GOG
export { getGOGGalaxyClientPath, getGOGGameId } from './gog';
// Steam
export {
  getAllInstalledSteamGames,
  getLastKnownLicensecacheSize,
  getLicensecachePath,
  getLicensecacheSize,
  getSteamLibraryAppIds,
  getSteamPath,
  invalidateSteamGamesCache,
  invalidateSteamLibraryAppIdsCache,
  invalidateSteamPathCache,
  updateLastKnownLicensecacheSize,
} from './steam';

// ============================================================================
// Main Detection Logic
// ============================================================================

export function detectGamePath(
  installPath: InstallPath | null | undefined
): GamePath | null {
  if (!installPath || !installPath.type || !installPath.path) return null;

  let foundPath: string | null = null;

  switch (installPath.type) {
    case 'steam':
      foundPath = findSteamGame(installPath.path);
      return {
        platform: 'steam',
        path: foundPath || '',
        exists: !!foundPath,
      };

    case 'gog':
      foundPath = findGOGGame(installPath.path);
      return {
        platform: 'gog',
        path: foundPath || '',
        exists: !!foundPath,
      };

    case 'epic':
      foundPath = findEpicGame(installPath.path);
      return {
        platform: 'epic',
        path: foundPath || '',
        exists: !!foundPath,
      };

    case 'rockstar':
      foundPath = findRockstarGame(installPath.path);
      return {
        platform: 'rockstar',
        path: foundPath || '',
        exists: !!foundPath,
      };
      
    case 'xbox':
      foundPath = findXboxGame(installPath.path);
      return {
        platform: 'xbox',
        path: foundPath || '',
        exists: !!foundPath,
      };

    case 'emulator':
    case 'other':
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
export function detectGamePaths(installPaths: InstallPath[]): GamePath[] {
  const results: GamePath[] = [];

  for (const installPath of installPaths) {
    const gamePath = detectGamePath(installPath);
    if (gamePath) {
      results.push(gamePath);
    }
  }

  return results;
}

/**
 * Get the first available game path
 */
export function getFirstAvailableGamePath(installPaths: InstallPath[]): GamePath | null {
  const paths = detectGamePaths(installPaths);
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
    installedPaths.push(...getInstalledGOGGamePaths());
  } catch (error) {
    console.error('[GameDetector] Error getting GOG games:', error);
  }

  // Epic games
  try {
    installedPaths.push(...getInstalledEpicGamePaths());
  } catch (error) {
    console.error('[GameDetector] Error getting Epic games:', error);
  }

  // Rockstar games
  try {
    installedPaths.push(...getInstalledRockstarGamePaths());
  } catch (error) {
    console.error('[GameDetector] Error getting Rockstar games:', error);
  }

  // Xbox games
  try {
    installedPaths.push(...getInstalledXboxGamePaths());
  } catch (error) {
    console.error('[GameDetector] Error getting Xbox games:', error);
  }

  console.log(
    `[GameDetector] Found ${installedPaths.length} installed game paths on system`
  );
  return installedPaths;
}

// Heroic Libraries
export { getEpicLibrary } from './epic';
export { getGogLibrary } from './gog';
export { getLutrisSlug } from './lutris';
// Xbox installed-games (no library API; only what's on disk)
export { getInstalledXboxGamePaths } from './xbox';

interface HeroicGameInfo {
  appName: string;
  runner: 'gog' | 'legendary';
}

export function getHeroicGame(gamePath: string): HeroicGameInfo | null {
  const gogId = getHeroicGOGId(gamePath);
  if (gogId) return { appName: gogId, runner: 'gog' };

  const epicAppName = getHeroicEpicAppName(gamePath);
  if (epicAppName) return { appName: epicAppName, runner: 'legendary' };

  return null;
}
