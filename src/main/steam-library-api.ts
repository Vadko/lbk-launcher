/**
 * Steam Library API - fetches owned games from Supabase Edge Function
 */

import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { getMachineId } from './tracking';

const SUPABASE_URL = 'https://supabase.lbklauncher.com';
const EDGE_FUNCTION_PATH = '/functions/v1/steam-library';

export interface SteamLibraryCache {
  steamId: string;
  appIds: number[];
  licensecacheSize: number;
  cachedAt: string;
}

interface EdgeFunctionResponse {
  success: boolean;
  appIds?: number[];
  count?: number;
  remaining?: number;
  error?: string;
}

/**
 * Get the path to the cache file
 */
function getCachePath(): string {
  return path.join(app.getPath('userData'), 'steam-library-cache.json');
}

/**
 * Read cached Steam library data
 */
export function readSteamLibraryCache(): SteamLibraryCache | null {
  try {
    const cachePath = getCachePath();
    if (!fs.existsSync(cachePath)) {
      return null;
    }

    const content = fs.readFileSync(cachePath, 'utf8');
    const cache = JSON.parse(content) as SteamLibraryCache;

    // Validate cache structure
    if (!cache.steamId || !Array.isArray(cache.appIds) || typeof cache.licensecacheSize !== 'number') {
      console.log('[SteamLibraryAPI] Invalid cache structure, ignoring');
      return null;
    }

    return cache;
  } catch (error) {
    console.error('[SteamLibraryAPI] Error reading cache:', error);
    return null;
  }
}

/**
 * Write Steam library data to cache
 */
export function writeSteamLibraryCache(cache: SteamLibraryCache): void {
  try {
    const cachePath = getCachePath();
    fs.writeFileSync(cachePath, JSON.stringify(cache, null, 2), 'utf8');
    console.log(`[SteamLibraryAPI] Cache saved: ${cache.appIds.length} apps`);
  } catch (error) {
    console.error('[SteamLibraryAPI] Error writing cache:', error);
  }
}

/**
 * Invalidate (delete) the cache
 */
export function invalidateSteamLibraryCache(): void {
  try {
    const cachePath = getCachePath();
    if (fs.existsSync(cachePath)) {
      fs.unlinkSync(cachePath);
      console.log('[SteamLibraryAPI] Cache invalidated');
    }
  } catch (error) {
    console.error('[SteamLibraryAPI] Error invalidating cache:', error);
  }
}

/**
 * Convert Steam3 ID to Steam64 ID
 * Steam3 ID: 126948360 (folder name in userdata)
 * Steam64 ID: 76561198087214088
 */
export function steam3ToSteam64(steam3Id: string | number): string {
  const steam3 = typeof steam3Id === 'string' ? BigInt(steam3Id) : BigInt(steam3Id);
  const steam64 = steam3 + BigInt('76561197960265728');
  return steam64.toString();
}

/**
 * Fetch Steam library from Edge Function
 * Returns null if request fails (rate limit, network error, etc.)
 */
export async function fetchSteamLibraryFromApi(
  steamId: string
): Promise<{ appIds: number[]; remaining: number } | null> {
  try {
    const machineId = getMachineId();
    if (!machineId) {
      console.error('[SteamLibraryAPI] Machine ID not available');
      return null;
    }

    const url = new URL(EDGE_FUNCTION_PATH, SUPABASE_URL);
    url.searchParams.set('steam_id', steamId);
    url.searchParams.set('machine_id', machineId);

    console.log(`[SteamLibraryAPI] Fetching library for Steam ID: ${steamId}`);

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const data: EdgeFunctionResponse = await response.json();

    if (!response.ok) {
      if (response.status === 429) {
        console.warn('[SteamLibraryAPI] Rate limit exceeded');
      } else if (response.status === 403) {
        console.warn('[SteamLibraryAPI] Steam profile is private or invalid Steam ID');
      } else {
        console.error('[SteamLibraryAPI] API error:', data.error);
      }
      return null;
    }

    if (!data.success || !data.appIds) {
      console.error('[SteamLibraryAPI] Invalid response:', data);
      return null;
    }

    console.log(
      `[SteamLibraryAPI] Fetched ${data.appIds.length} apps, remaining requests: ${data.remaining}`
    );

    return {
      appIds: data.appIds,
      remaining: data.remaining ?? 0,
    };
  } catch (error) {
    console.error('[SteamLibraryAPI] Network error:', error);
    return null;
  }
}
