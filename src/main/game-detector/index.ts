/**
 * Game Detector - Main Entry Point
 * Detects installed games from various platforms (Steam, Epic, GOG, Rockstar)
 */

import type { InstallPath } from '../../shared/types';
import { findEpicGame, getInstalledEpicGamePaths } from './epic';
import { findGOGGame, getInstalledGOGGamePaths } from './gog';
import { findRockstarGame, getInstalledRockstarGamePaths } from './rockstar';
import { findSteamGame, getInstalledSteamGamePaths } from './steam';
import type { GamePath } from './types'; // Used locally

// ============================================================================
// Re-exports
// ============================================================================

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

// GOG
export { getGOGGalaxyClientPath, getGOGGameId } from './gog';

// ============================================================================
// Main Detection Logic
// ============================================================================

/**
 * Detect all possible paths for a game
 */
function detectGamePaths(installPaths: InstallPath[]): GamePath[] {
  const results: GamePath[] = [];

  for (const installPath of installPaths) {
    if (!installPath.type || !installPath.path) continue;

    let foundPath: string | null = null;

    switch (installPath.type) {
      case 'steam':
        foundPath = findSteamGame(installPath.path);
        results.push({
          platform: 'steam',
          path: foundPath || '',
          exists: !!foundPath,
        });
        break;

      case 'gog':
        foundPath = findGOGGame(installPath.path);
        results.push({
          platform: 'gog',
          path: foundPath || '',
          exists: !!foundPath,
        });
        break;

      case 'epic':
        foundPath = findEpicGame(installPath.path);
        results.push({
          platform: 'epic',
          path: foundPath || '',
          exists: !!foundPath,
        });
        break;

      case 'rockstar':
        foundPath = findRockstarGame(installPath.path);
        results.push({
          platform: 'rockstar',
          path: foundPath || '',
          exists: !!foundPath,
        });
        break;

      case 'emulator':
      case 'other':
        // These platforms require manual path selection
        results.push({
          platform: installPath.type,
          path: '',
          exists: false,
        });
        break;
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

  console.log(
    `[GameDetector] Found ${installedPaths.length} installed game paths on system`
  );
  return installedPaths;
}

// Heroic Libraries
export { getEpicLibrary } from './epic';
export { getGogLibrary } from './gog';
