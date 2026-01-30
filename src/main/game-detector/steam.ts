/**
 * Steam Game Detection
 * Handles Steam path detection, library scanning, and owned games fetching
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  fetchSteamLibraryFromApi,
  invalidateSteamLibraryCache,
  readSteamLibraryCache,
  steam3ToSteam64,
  writeSteamLibraryCache,
} from '../steam-library-api';
import { getPlatform, isLinux, isMacOS, isWindows } from '../utils/platform';
import {
  parseAppManifest,
  parseLibraryFolders,
  parseLocalConfigApps,
  parseLocalConfigPlaytime,
  parseMostRecentUser,
  type SteamAppPlaytime,
} from '../utils/vdf-parser';

// ============================================================================
// Cache State
// ============================================================================

interface SteamCache {
  /** Steam installation path (undefined = not checked, null = not found) */
  steamPath: string | null | undefined;
  /** Steam library folders */
  libraryFolders: { steamPath: string; folders: string[] } | null;
  /** Installed Steam games (installdir -> full path) */
  installedGames: Map<string, string> | null;
  /** Steam library App IDs (owned games) */
  libraryAppIds: number[] | null;
  /** Last known licensecache size (for watcher comparison) */
  lastKnownLicensecacheSize: number | null;
}

const cache: SteamCache = {
  steamPath: undefined,
  libraryFolders: null,
  installedGames: null,
  libraryAppIds: null,
  lastKnownLicensecacheSize: null,
};

// ============================================================================
// Steam Path Detection
// ============================================================================

/**
 * Validate if a path is a valid Steam installation
 */
function isValidSteamPath(steamPath: string): boolean {
  try {
    const requiredDirs = ['steamapps', 'appcache', 'config'];
    return requiredDirs.every((dir) => fs.existsSync(path.join(steamPath, dir)));
  } catch {
    return false;
  }
}

/**
 * Detect Steam installation path (with caching)
 */
export function getSteamPath(): string | null {
  if (cache.steamPath !== undefined) {
    return cache.steamPath;
  }

  console.log('[Steam] Platform:', getPlatform());

  try {
    if (isWindows()) {
      const result = detectSteamPathWindows();
      if (result) {
        cache.steamPath = result;
        return result;
      }
    } else if (isMacOS()) {
      const result = detectSteamPathMacOS();
      if (result) {
        cache.steamPath = result;
        return result;
      }
    } else if (isLinux()) {
      const result = detectSteamPathLinux();
      if (result) {
        cache.steamPath = result;
        return result;
      }
    }
  } catch (error) {
    console.error('[Steam] Error detecting path:', error);
  }

  console.warn('[Steam] Steam not found on this system');
  cache.steamPath = null;
  return null;
}

function detectSteamPathWindows(): string | null {
  const regPath = path.join(
    process.env.SystemRoot || 'C:\\Windows',
    'System32',
    'reg.exe'
  );

  // Try 64-bit registry
  try {
    const output = execSync(
      `"${regPath}" query "HKEY_LOCAL_MACHINE\\SOFTWARE\\WOW6432Node\\Valve\\Steam" /v InstallPath`,
      { encoding: 'utf8' }
    );
    const match = output.match(/InstallPath\s+REG_SZ\s+(.+)/);
    if (match?.[1]) {
      const steamPath = match[1].trim();
      if (isValidSteamPath(steamPath)) {
        console.log('[Steam] Found at:', steamPath);
        return steamPath;
      }
    }
  } catch {
    // Try 32-bit registry
    try {
      const output = execSync(
        `"${regPath}" query "HKEY_LOCAL_MACHINE\\SOFTWARE\\Valve\\Steam" /v InstallPath`,
        { encoding: 'utf8' }
      );
      const match = output.match(/InstallPath\s+REG_SZ\s+(.+)/);
      if (match?.[1]) {
        const steamPath = match[1].trim();
        if (isValidSteamPath(steamPath)) {
          console.log('[Steam] Found at (32-bit):', steamPath);
          return steamPath;
        }
      }
    } catch {
      console.warn('[Steam] Registry query failed, trying default paths...');
    }
  }

  // Fallback to default paths
  const defaultPaths = [
    'C:\\Program Files (x86)\\Steam',
    'C:\\Program Files\\Steam',
    path.join(process.env.PROGRAMFILES || 'C:\\Program Files', 'Steam'),
    path.join(process.env['PROGRAMFILES(X86)'] || 'C:\\Program Files (x86)', 'Steam'),
  ];

  for (const defaultPath of defaultPaths) {
    if (fs.existsSync(defaultPath) && isValidSteamPath(defaultPath)) {
      console.log('[Steam] Found at default location:', defaultPath);
      return defaultPath;
    }
  }

  return null;
}

function detectSteamPathMacOS(): string | null {
  const macPaths = [
    path.join(os.homedir(), 'Library/Application Support/Steam'),
    '/Applications/Steam.app/Contents/MacOS',
  ];

  for (const macPath of macPaths) {
    if (fs.existsSync(macPath) && isValidSteamPath(macPath)) {
      console.log('[Steam] Found at:', macPath);
      return macPath;
    }
  }

  return null;
}

function detectSteamPathLinux(): string | null {
  const linuxPaths = [
    path.join(os.homedir(), '.steam/steam'),
    path.join(os.homedir(), '.local/share/Steam'),
    path.join(os.homedir(), '.var/app/com.valvesoftware.Steam/.steam/steam'),
    path.join(os.homedir(), '.var/app/com.valvesoftware.Steam/.local/share/Steam'),
    '/usr/share/steam',
    '/usr/local/share/steam',
    path.join(os.homedir(), 'snap/steam/common/.steam/steam'),
    path.join(os.homedir(), 'snap/steam/common/.local/share/Steam'),
  ];

  for (const linuxPath of linuxPaths) {
    if (fs.existsSync(linuxPath) && isValidSteamPath(linuxPath)) {
      console.log('[Steam] Found at:', linuxPath);
      return linuxPath;
    }
  }

  return null;
}

// ============================================================================
// Steam User Detection
// ============================================================================

/**
 * Convert Steam64 ID to Steam3 ID (internal)
 */
function steam64ToSteam3(steam64Id: string): string {
  const steam64 = BigInt(steam64Id);
  const steam3 = steam64 - BigInt('76561197960265728');
  return steam3.toString();
}

/**
 * Get the current Steam3 user ID (active/most recent user) (internal)
 * @param steamPath - Steam installation path
 */
function getCurrentSteamUserId(steamPath: string): string | null {
  // Try to get most recent user from loginusers.vdf
  try {
    const loginUsersPath = path.join(steamPath, 'config', 'loginusers.vdf');
    if (fs.existsSync(loginUsersPath)) {
      const content = fs.readFileSync(loginUsersPath, 'utf8');
      const steam64Id = parseMostRecentUser(content);
      if (steam64Id) {
        const steam3Id = steam64ToSteam3(steam64Id);
        const userdataPath = path.join(steamPath, 'userdata', steam3Id);
        if (fs.existsSync(userdataPath)) {
          return steam3Id;
        }
        console.warn(
          `[Steam] Most recent user ${steam3Id} found but userdata folder doesn't exist`
        );
      }
    }
  } catch (error) {
    console.warn('[Steam] Error reading loginusers.vdf:', error);
  }

  // Fallback: use first available userdata folder
  try {
    const userdataPath = path.join(steamPath, 'userdata');
    if (!fs.existsSync(userdataPath)) return null;

    const userFolders = fs
      .readdirSync(userdataPath, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && /^\d+$/.test(entry.name))
      .map((entry) => entry.name);

    if (userFolders.length > 0) {
      console.warn(
        `[Steam] Using fallback: first userdata folder ${userFolders[0]} (${userFolders.length} total)`
      );
      return userFolders[0];
    }
  } catch {
    // Ignore
  }

  return null;
}

// ============================================================================
// User Config Paths
// ============================================================================

/**
 * Get the path to a file in the current user's config folder
 * Base path: Steam/userdata/{userId}/config/{filename}
 */
function getUserConfigPath(filename: string): string | null {
  const steamPath = getSteamPath();
  if (!steamPath) return null;

  const steamUserId = getCurrentSteamUserId(steamPath);
  if (!steamUserId) return null;

  return path.join(steamPath, 'userdata', steamUserId, 'config', filename);
}

/**
 * Get the path to localconfig.vdf for current user
 */
function getLocalConfigPath(): string | null {
  return getUserConfigPath('localconfig.vdf');
}

/**
 * Read localconfig.vdf content for current user
 * Returns null if Steam/user not found or file doesn't exist
 */
function readLocalConfigContent(): string | null {
  const localConfigPath = getLocalConfigPath();
  if (!localConfigPath) return null;

  try {
    if (!fs.existsSync(localConfigPath)) {
      console.log(`[Steam] localconfig.vdf not found at ${localConfigPath}`);
      return null;
    }
    return fs.readFileSync(localConfigPath, 'utf8');
  } catch (error) {
    console.error('[Steam] Error reading localconfig.vdf:', error);
    return null;
  }
}

/**
 * Get the path to licensecache file for current user
 */
export function getLicensecachePath(): string | null {
  return getUserConfigPath('licensecache');
}

/**
 * Get the current size of licensecache file
 */
export function getLicensecacheSize(): number | null {
  const licensecachePath = getLicensecachePath();
  if (!licensecachePath || !fs.existsSync(licensecachePath)) return null;

  try {
    return fs.statSync(licensecachePath).size;
  } catch {
    return null;
  }
}

/**
 * Get the last known licensecache size (for watcher)
 */
export function getLastKnownLicensecacheSize(): number | null {
  return cache.lastKnownLicensecacheSize;
}

/**
 * Update the last known licensecache size
 */
export function updateLastKnownLicensecacheSize(size: number | null): void {
  cache.lastKnownLicensecacheSize = size;
}

// ============================================================================
// Steam Library Folders
// ============================================================================

/**
 * Get Steam library folders (with caching) (internal)
 */
function getSteamLibraryFolders(steamPath: string): string[] {
  if (cache.libraryFolders?.steamPath === steamPath) {
    return cache.libraryFolders.folders;
  }

  const folders: string[] = [path.join(steamPath, 'steamapps')];
  console.log('[Steam] Default library:', folders[0]);

  try {
    const libraryFoldersPath = path.join(steamPath, 'steamapps', 'libraryfolders.vdf');
    if (fs.existsSync(libraryFoldersPath)) {
      const content = fs.readFileSync(libraryFoldersPath, 'utf8');
      const libraryPaths = parseLibraryFolders(content);

      for (const libraryPath of libraryPaths) {
        const normalizedPath = libraryPath.replace(/\\\\/g, '\\');
        const steamappsPath = path.join(normalizedPath, 'steamapps');
        if (fs.existsSync(steamappsPath) && !folders.includes(steamappsPath)) {
          console.log('[Steam] Additional library found:', steamappsPath);
          folders.push(steamappsPath);
        }
      }
    }
  } catch (error) {
    console.error('[Steam] Error parsing library folders:', error);
  }

  console.log(`[Steam] Total libraries found: ${folders.length}`);
  cache.libraryFolders = { steamPath, folders };
  return folders;
}

// ============================================================================
// Installed Steam Games Detection
// ============================================================================

/**
 * Get all installed games from appmanifest files (with caching)
 */
function getAllSteamGames(libraryFolders: string[]): Map<string, string> {
  if (cache.installedGames !== null) {
    console.log(
      `[Steam] Using cached installed games (${cache.installedGames.size} games)`
    );
    return cache.installedGames;
  }

  console.log('[Steam] Scanning libraries for installed games...');
  const games = new Map<string, string>();

  for (const folder of libraryFolders) {
    try {
      const files = fs.readdirSync(folder);
      const manifestFiles = files.filter(
        (f) => f.startsWith('appmanifest_') && f.endsWith('.acf')
      );

      for (const manifestFile of manifestFiles) {
        const manifestPath = path.join(folder, manifestFile);
        try {
          const content = fs.readFileSync(manifestPath, 'utf8');
          const manifest = parseAppManifest(content);

          if (manifest?.installdir) {
            const gamePath = path.join(folder, 'common', manifest.installdir);
            if (fs.existsSync(gamePath)) {
              games.set(manifest.installdir.toLowerCase(), gamePath);
              console.log(
                `[Steam] Found game: ${manifest.name} (${manifest.installdir})`
              );
            }
          }
        } catch (err) {
          console.error(`[Steam] Error parsing manifest ${manifestFile}:`, err);
        }
      }
    } catch (err) {
      console.error(`[Steam] Error reading library folder ${folder}:`, err);
    }
  }

  cache.installedGames = games;
  return games;
}

/**
 * Find Steam game by folder name
 */
export function findSteamGame(gameFolderName: string): string | null {
  console.log(`[Steam] Searching for game: "${gameFolderName}"`);

  // Normalize the folder name
  const normalizedFolderName = gameFolderName
    .replace(/^steamapps[/\\]common[/\\]/i, '')
    .replace(/^common[/\\]/i, '');

  if (normalizedFolderName !== gameFolderName) {
    console.log(`[Steam] Normalized: "${gameFolderName}" -> "${normalizedFolderName}"`);
  }

  const steamPath = getSteamPath();
  if (!steamPath) {
    console.warn('[Steam] Cannot search - Steam not found');
    return null;
  }

  const libraryFolders = getSteamLibraryFolders(steamPath);
  const installedGames = getAllSteamGames(libraryFolders);

  // Try exact match via appmanifest
  const gamePathFromManifest = installedGames.get(normalizedFolderName.toLowerCase());
  if (gamePathFromManifest) {
    const actualBasename = path.basename(gamePathFromManifest).toLowerCase();
    if (actualBasename === normalizedFolderName.toLowerCase()) {
      if (fs.existsSync(gamePathFromManifest)) {
        console.log(`[Steam] ✓ Game found via appmanifest: ${gamePathFromManifest}`);
        return gamePathFromManifest;
      }
    }
  }

  // Fallback: try exact path matching
  console.log('[Steam] Not found via appmanifest, checking folders...');
  for (const folder of libraryFolders) {
    const commonPath = path.join(folder, 'common', normalizedFolderName);
    if (fs.existsSync(commonPath)) {
      console.log(`[Steam] ✓ Game found at (fallback): ${commonPath}`);
      return commonPath;
    }
  }

  console.warn(`[Steam] ✗ Game "${gameFolderName}" not found`);
  return null;
}

/**
 * Get all installed Steam games as a Map
 */
export function getAllInstalledSteamGames(): Map<string, string> {
  const steamPath = getSteamPath();
  if (!steamPath) {
    console.log('[Steam] Steam not found');
    return new Map();
  }

  const libraryFolders = getSteamLibraryFolders(steamPath);
  return getAllSteamGames(libraryFolders);
}

/**
 * Get all installed Steam game paths for matching
 */
export function getInstalledSteamGamePaths(): string[] {
  const paths: string[] = [];
  const steamPath = getSteamPath();

  if (steamPath) {
    const libraryFolders = getSteamLibraryFolders(steamPath);
    const steamGames = getAllSteamGames(libraryFolders);

    for (const [installdir] of steamGames.entries()) {
      paths.push(`steamapps/common/${installdir}`);
      paths.push(`common/${installdir}`);
      paths.push(installdir);
    }
  }

  return paths;
}

// ============================================================================
// Steam Library App IDs (Owned Games)
// ============================================================================

/**
 * Get all Steam App IDs from user's library (owned games, installed or not)
 */
export async function getSteamLibraryAppIds(): Promise<number[]> {
  // Return in-memory cache if available
  if (cache.libraryAppIds !== null) {
    console.log(
      `[Steam] Library: using in-memory cache (${cache.libraryAppIds.length} apps)`
    );
    return cache.libraryAppIds;
  }

  const steamPath = getSteamPath();
  if (!steamPath) {
    console.log('[Steam] Steam not found, returning empty App IDs');
    return [];
  }

  const steam3Id = getCurrentSteamUserId(steamPath);
  if (!steam3Id) {
    console.log('[Steam] No Steam user found');
    return [];
  }

  const steam64Id = steam3ToSteam64(steam3Id);
  const currentLicensecacheSize = getLicensecacheSize();

  if (currentLicensecacheSize !== null) {
    updateLastKnownLicensecacheSize(currentLicensecacheSize);
  }

  console.log(
    `[Steam] User: ${steam3Id} (${steam64Id}), licensecache size: ${currentLicensecacheSize}`
  );

  // Check file cache
  const fileCache = readSteamLibraryCache();
  if (fileCache) {
    const isSameUser = fileCache.steamId === steam64Id;
    const isSameLicensecacheSize = fileCache.licensecacheSize === currentLicensecacheSize;

    if (isSameUser && isSameLicensecacheSize) {
      console.log(
        `[Steam] Library: using file cache (${fileCache.appIds.length} apps, cached at ${fileCache.cachedAt})`
      );
      cache.libraryAppIds = fileCache.appIds;
      return fileCache.appIds;
    }

    if (!isSameUser) {
      console.log(
        `[Steam] Library: cache invalid - user changed (${fileCache.steamId} -> ${steam64Id}), refreshing...`
      );
    } else if (!isSameLicensecacheSize) {
      console.log(
        `[Steam] Library: cache invalid - licensecache size changed (${fileCache.licensecacheSize} -> ${currentLicensecacheSize}), refreshing...`
      );
    }
  } else {
    console.log('[Steam] Library: no cache found, fetching from API...');
  }

  // Fetch from API
  const apiResult = await fetchSteamLibraryFromApi(steam64Id);

  if (apiResult) {
    writeSteamLibraryCache({
      steamId: steam64Id,
      appIds: apiResult.appIds,
      licensecacheSize: currentLicensecacheSize ?? 0,
      cachedAt: new Date().toISOString(),
    });

    cache.libraryAppIds = apiResult.appIds;
    console.log(
      `[Steam] Library: refreshed from API (${apiResult.appIds.length} apps, ${apiResult.remaining} requests remaining)`
    );
    return apiResult.appIds;
  }

  // Fallback to localconfig.vdf
  console.log('[Steam] Library: API failed, falling back to localconfig.vdf');
  return getSteamLibraryAppIdsFallback();
}

function getSteamLibraryAppIdsFallback(): number[] {
  const content = readLocalConfigContent();
  if (!content) {
    return [];
  }

  const appIds = parseLocalConfigApps(content);
  console.log(`[Steam] Library: using localconfig.vdf fallback (${appIds.length} apps)`);
  cache.libraryAppIds = appIds;
  return appIds;
}

// ============================================================================
// Cache Invalidation
// ============================================================================

/**
 * Invalidate Steam path cache (and dependent caches)
 */
export function invalidateSteamPathCache(): void {
  console.log('[Steam] Invalidating path cache');
  cache.steamPath = undefined;
  cache.libraryFolders = null;
  cache.libraryAppIds = null;
}

/**
 * Invalidate Steam games cache
 */
export function invalidateSteamGamesCache(): void {
  console.log('[Steam] Invalidating games cache');
  cache.installedGames = null;
}

/**
 * Invalidate Steam library App IDs cache
 */
export function invalidateSteamLibraryAppIdsCache(): void {
  console.log('[Steam] Invalidating library App IDs cache');
  cache.libraryAppIds = null;
  invalidateSteamLibraryCache(); // Also invalidate file cache
}

// ============================================================================
// Steam Playtime Detection
// ============================================================================

/**
 * Get playtime for all Steam apps from localconfig.vdf
 * Returns Map of App ID -> playtime data
 */
function getSteamPlaytimes(): Map<number, SteamAppPlaytime> {
  const content = readLocalConfigContent();
  if (!content) {
    return new Map();
  }

  const playtimes = parseLocalConfigPlaytime(content);
  console.log(`[Steam] Playtime: found data for ${playtimes.size} apps`);
  return playtimes;
}

/**
 * Get playtime for specific Steam App IDs
 * @param appIds - Array of Steam App IDs to get playtime for
 * @returns Map of App ID -> playtime in minutes
 */
export function getSteamPlaytimesForApps(
  appIds: number[]
): Map<number, SteamAppPlaytime> {
  const allPlaytimes = getSteamPlaytimes();
  const result = new Map<number, SteamAppPlaytime>();

  for (const appId of appIds) {
    const playtime = allPlaytimes.get(appId);
    if (playtime) {
      result.set(appId, playtime);
    }
  }

  return result;
}
