/**
 * Playtime Tracker
 *
 * Відстежує час гри з українізатором через Steam playtime.
 * При зміні playtime для встановлених локалізацій відправляє дельту на сервер.
 *
 * Логіка:
 * 1. При запуску лаунчера - зчитуємо поточний playtime для ігор з встановленими локалізаціями
 * 2. При закритті лаунчера - порівнюємо з початковим значенням
 * 3. Якщо є різниця - відправляємо на сервер
 */

import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { getSteamPlaytimesForApps } from './game-detector/steam';
import { getAllInstalledGameIds } from './installer';

// ============================================================================
// Types
// ============================================================================

interface PlaytimeCacheEntry {
  /** Steam App ID */
  steamAppId: number;
  /** Game ID in our system */
  gameId: string;
  /** Playtime in minutes at the start of session */
  playtimeAtStart: number;
  /** Last played timestamp at the start of session */
  lastPlayedAtStart?: number;
}

interface PlaytimeCache {
  /** Session start time (ISO string) */
  sessionStart: string;
  /** Cached playtimes per game */
  entries: PlaytimeCacheEntry[];
}

interface PlaytimeDelta {
  gameId: string;
  steamAppId: number;
  /** Playtime increase in minutes during this session */
  deltaMinutes: number;
}

// ============================================================================
// State
// ============================================================================

let sessionCache: PlaytimeCache | null = null;

// ============================================================================
// Cache File Management
// ============================================================================

function getCacheFilePath(): string {
  return path.join(app.getPath('userData'), 'playtime-cache.json');
}

function readCacheFromDisk(): PlaytimeCache | null {
  try {
    const filePath = getCacheFilePath();
    if (!fs.existsSync(filePath)) return null;

    const content = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(content) as PlaytimeCache;
  } catch (error) {
    console.error('[PlaytimeTracker] Error reading cache:', error);
    return null;
  }
}

function writeCacheToDisk(cache: PlaytimeCache): void {
  try {
    const filePath = getCacheFilePath();
    fs.writeFileSync(filePath, JSON.stringify(cache, null, 2), 'utf8');
    console.log('[PlaytimeTracker] Cache saved to disk');
  } catch (error) {
    console.error('[PlaytimeTracker] Error writing cache:', error);
  }
}

function deleteCacheFromDisk(): void {
  try {
    const filePath = getCacheFilePath();
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (error) {
    console.error('[PlaytimeTracker] Error deleting cache:', error);
  }
}

// ============================================================================
// Installed Games with Steam App ID
// ============================================================================

interface InstalledGameWithSteamId {
  gameId: string;
  steamAppId: number;
}

/**
 * Get list of installed games that have Steam App ID
 */
async function getInstalledGamesWithSteamIds(): Promise<InstalledGameWithSteamId[]> {
  const result: InstalledGameWithSteamId[] = [];

  try {
    // Get all installed game IDs from our cache
    const installedGameIds = await getAllInstalledGameIds();
    console.log(
      `[PlaytimeTracker] Found ${installedGameIds.length} installed localizations`
    );

    if (installedGameIds.length === 0) {
      return result;
    }

    // Import database to get steam_app_id for each game
    const { getDatabase } = await import('./db/database');
    const db = getDatabase();

    for (const gameId of installedGameIds) {
      try {
        const game = db
          .prepare('SELECT steam_app_id FROM games WHERE id = ?')
          .get(gameId) as { steam_app_id: number | null } | undefined;

        if (game?.steam_app_id) {
          result.push({
            gameId,
            steamAppId: game.steam_app_id,
          });
          console.log(
            `[PlaytimeTracker]   - ${gameId} -> Steam App ${game.steam_app_id}`
          );
        } else {
          console.log(`[PlaytimeTracker]   - ${gameId} -> no steam_app_id in DB`);
        }
      } catch (err) {
        console.log(`[PlaytimeTracker]   - ${gameId} -> not found in DB`);
      }
    }
  } catch (error) {
    console.error('[PlaytimeTracker] Error getting installed games:', error);
  }

  console.log(`[PlaytimeTracker] Games with Steam App ID: ${result.length}`);
  return result;
}

// ============================================================================
// Main Functions
// ============================================================================

/**
 * Called at launcher startup
 * 1. First checks for orphaned cache from previous session (crash recovery)
 * 2. Then records current playtime for all installed games
 *
 * Returns deltas from orphaned session (if any) for immediate sending
 */
export async function recordPlaytimeAtSessionStart(): Promise<PlaytimeDelta[]> {
  console.log('[PlaytimeTracker] Recording playtime at session start...');

  // Step 1: Check for orphaned cache from previous crashed/force-quit session
  const recoveredDeltas = await recoverOrphanedSession();

  try {
    // Step 2: Get installed games with Steam App IDs
    const installedGames = await getInstalledGamesWithSteamIds();
    if (installedGames.length === 0) {
      console.log('[PlaytimeTracker] No installed games with Steam App IDs found');
      sessionCache = null;
      deleteCacheFromDisk();
      return recoveredDeltas;
    }

    const steamAppIds = installedGames.map((g) => g.steamAppId);
    console.log(
      `[PlaytimeTracker] Checking playtime for ${steamAppIds.length} Steam apps: ${steamAppIds.join(', ')}`
    );

    // Get current playtimes from Steam
    const playtimes = getSteamPlaytimesForApps(steamAppIds);
    console.log(`[PlaytimeTracker] Steam returned playtime for ${playtimes.size} apps`);

    // Build cache entries
    const entries: PlaytimeCacheEntry[] = [];
    for (const game of installedGames) {
      const playtime = playtimes.get(game.steamAppId);
      entries.push({
        steamAppId: game.steamAppId,
        gameId: game.gameId,
        playtimeAtStart: playtime?.playtimeMinutes ?? 0,
        lastPlayedAtStart: playtime?.lastPlayed,
      });
    }

    sessionCache = {
      sessionStart: new Date().toISOString(),
      entries,
    };

    // Save to disk in case of crash
    writeCacheToDisk(sessionCache);

    console.log(`[PlaytimeTracker] Recorded playtime for ${entries.length} games`);
    for (const entry of entries) {
      console.log(
        `[PlaytimeTracker]   - ${entry.gameId}: ${entry.playtimeAtStart} minutes (Steam App ${entry.steamAppId})`
      );
    }
  } catch (error) {
    console.error('[PlaytimeTracker] Error recording playtime at start:', error);
  }

  return recoveredDeltas;
}

/**
 * Recover playtime data from a previous session that didn't close properly
 * (crash, force quit, kill process)
 */
async function recoverOrphanedSession(): Promise<PlaytimeDelta[]> {
  const deltas: PlaytimeDelta[] = [];

  try {
    const cacheFilePath = getCacheFilePath();
    console.log(`[PlaytimeTracker] Checking for orphaned cache at: ${cacheFilePath}`);

    const orphanedCache = readCacheFromDisk();
    if (!orphanedCache || orphanedCache.entries.length === 0) {
      console.log('[PlaytimeTracker] No orphaned cache found');
      return deltas;
    }

    // Check if this cache is from a previous session (not current)
    // If sessionCache exists in memory, the disk cache is from THIS session
    if (sessionCache !== null) {
      console.log('[PlaytimeTracker] Cache is from current session, skipping recovery');
      return deltas;
    }

    console.log(
      `[PlaytimeTracker] Found orphaned cache from ${orphanedCache.sessionStart} with ${orphanedCache.entries.length} entries, recovering...`
    );

    // Get current playtimes
    const steamAppIds = orphanedCache.entries.map((e) => e.steamAppId);
    const currentPlaytimes = getSteamPlaytimesForApps(steamAppIds);

    for (const entry of orphanedCache.entries) {
      const current = currentPlaytimes.get(entry.steamAppId);
      const currentMinutes = current?.playtimeMinutes ?? 0;
      const delta = currentMinutes - entry.playtimeAtStart;

      if (delta > 0) {
        deltas.push({
          gameId: entry.gameId,
          steamAppId: entry.steamAppId,
          deltaMinutes: delta,
        });

        console.log(
          `[PlaytimeTracker] Recovered delta for ${entry.gameId}: +${delta} minutes ` +
            `(${entry.playtimeAtStart} -> ${currentMinutes})`
        );
      }
    }

    // Delete orphaned cache after processing
    deleteCacheFromDisk();

    if (deltas.length > 0) {
      console.log(
        `[PlaytimeTracker] Recovered ${deltas.length} games with playtime from crashed session`
      );
    }
  } catch (error) {
    console.error('[PlaytimeTracker] Error recovering orphaned session:', error);
  }

  return deltas;
}

/**
 * Called at launcher shutdown
 * Compares current playtime with recorded values and returns deltas
 */
export async function calculatePlaytimeDeltas(): Promise<PlaytimeDelta[]> {
  console.log('[PlaytimeTracker] Calculating playtime deltas...');

  const deltas: PlaytimeDelta[] = [];

  try {
    // Use in-memory cache or read from disk (in case of restart)
    const cache = sessionCache || readCacheFromDisk();
    if (!cache || cache.entries.length === 0) {
      console.log('[PlaytimeTracker] No cache found, skipping delta calculation');
      return deltas;
    }

    const steamAppIds = cache.entries.map((e) => e.steamAppId);
    const currentPlaytimes = getSteamPlaytimesForApps(steamAppIds);

    for (const entry of cache.entries) {
      const current = currentPlaytimes.get(entry.steamAppId);
      const currentMinutes = current?.playtimeMinutes ?? 0;
      const delta = currentMinutes - entry.playtimeAtStart;

      if (delta > 0) {
        deltas.push({
          gameId: entry.gameId,
          steamAppId: entry.steamAppId,
          deltaMinutes: delta,
        });

        console.log(
          `[PlaytimeTracker] Delta for ${entry.gameId}: +${delta} minutes ` +
            `(${entry.playtimeAtStart} -> ${currentMinutes})`
        );
      }
    }

    // Clean up cache after processing
    sessionCache = null;
    deleteCacheFromDisk();

    console.log(`[PlaytimeTracker] Found ${deltas.length} games with playtime changes`);
  } catch (error) {
    console.error('[PlaytimeTracker] Error calculating deltas:', error);
  }

  return deltas;
}
