import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import type { InstallPath } from '../shared/types';
import type { Database } from '../lib/database.types';
import { parseLibraryFolders, parseAppManifest } from './utils/vdf-parser';

export interface GamePath {
  platform: Database['public']['Enums']['install_source'];
  path: string;
  exists: boolean;
}

/**
 * Validate if a path is a valid Steam installation
 */
function isValidSteamPath(steamPath: string): boolean {
  try {
    const requiredDirs = ['steamapps', 'appcache', 'config'];
    return requiredDirs.every(dir => fs.existsSync(path.join(steamPath, dir)));
  } catch {
    return false;
  }
}

// Cache for Steam path
let steamPathCache: string | null | undefined = undefined;

/**
 * Detect Steam installation path (with caching)
 */
export function getSteamPath(): string | null {
  // Return cached value if already checked
  if (steamPathCache !== undefined) {
    return steamPathCache;
  }

  console.log('[GameDetector] Platform:', process.platform);
  try {
    if (process.platform === 'win32') {
      // Windows: Read from registry using full path to reg.exe
      const regPath = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'reg.exe');
      console.log('[GameDetector] Using reg.exe at:', regPath);

      try {
        const output = execSync(
          `"${regPath}" query "HKEY_LOCAL_MACHINE\\SOFTWARE\\WOW6432Node\\Valve\\Steam" /v InstallPath`,
          { encoding: 'utf8' }
        );
        const match = output.match(/InstallPath\s+REG_SZ\s+(.+)/);
        if (match && match[1]) {
          const steamPath = match[1].trim();
          if (isValidSteamPath(steamPath)) {
            console.log('[GameDetector] Steam found at:', steamPath);
            steamPathCache = steamPath;
            return steamPath;
          }
        }
      } catch (err) {
        console.log('[GameDetector] 64-bit registry not found, trying 32-bit...');
        try {
          // Try 32-bit registry path
          const output = execSync(
            `"${regPath}" query "HKEY_LOCAL_MACHINE\\SOFTWARE\\Valve\\Steam" /v InstallPath`,
            { encoding: 'utf8' }
          );
          const match = output.match(/InstallPath\s+REG_SZ\s+(.+)/);
          if (match && match[1]) {
            const steamPath = match[1].trim();
            if (isValidSteamPath(steamPath)) {
              console.log('[GameDetector] Steam found at (32-bit):', steamPath);
              steamPathCache = steamPath;
              return steamPath;
            }
          }
        } catch (innerErr) {
          console.warn('[GameDetector] Registry query failed, trying default paths...');
        }
      }

      // Fallback: Try common default Steam installation paths on Windows
      const defaultPaths = [
        'C:\\Program Files (x86)\\Steam',
        'C:\\Program Files\\Steam',
        path.join(process.env.PROGRAMFILES || 'C:\\Program Files', 'Steam'),
        path.join(process.env['PROGRAMFILES(X86)'] || 'C:\\Program Files (x86)', 'Steam'),
      ];

      for (const defaultPath of defaultPaths) {
        if (fs.existsSync(defaultPath) && isValidSteamPath(defaultPath)) {
          console.log('[GameDetector] Steam found at default location:', defaultPath);
          steamPathCache = defaultPath;
          return defaultPath;
        }
      }
    } else if (process.platform === 'darwin') {
      // macOS
      const macPaths = [
        path.join(os.homedir(), 'Library/Application Support/Steam'),
        '/Applications/Steam.app/Contents/MacOS',
      ];

      for (const macPath of macPaths) {
        if (fs.existsSync(macPath) && isValidSteamPath(macPath)) {
          console.log('[GameDetector] Steam found at:', macPath);
          steamPathCache = macPath;
          return macPath;
        }
      }
    } else if (process.platform === 'linux') {
      // Linux - multiple installation methods
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
          console.log('[GameDetector] Steam found at:', linuxPath);
          steamPathCache = linuxPath;
          return linuxPath;
        }
      }
    }
  } catch (error) {
    console.error('[GameDetector] Error detecting Steam path:', error);
  }
  console.warn('[GameDetector] Steam not found on this system');
  steamPathCache = null;
  return null;
}

/**
 * Invalidate Steam path cache
 */
export function invalidateSteamPathCache(): void {
  console.log('[GameDetector] Invalidating Steam path cache');
  steamPathCache = undefined;
  steamLibraryFoldersCache = null;
}

// Cache for Steam library folders
let steamLibraryFoldersCache: { steamPath: string; folders: string[] } | null = null;

/**
 * Parse Steam library folders (with caching)
 */
function getSteamLibraryFolders(steamPath: string): string[] {
  // Return cached value if already loaded for this Steam path
  if (steamLibraryFoldersCache && steamLibraryFoldersCache.steamPath === steamPath) {
    return steamLibraryFoldersCache.folders;
  }

  const folders: string[] = [path.join(steamPath, 'steamapps')];
  console.log('[GameDetector] Default Steam library:', folders[0]);

  try {
    const libraryFoldersPath = path.join(steamPath, 'steamapps', 'libraryfolders.vdf');
    if (fs.existsSync(libraryFoldersPath)) {
      const content = fs.readFileSync(libraryFoldersPath, 'utf8');

      // Use proper VDF parser
      const libraryPaths = parseLibraryFolders(content);
      for (const libraryPath of libraryPaths) {
        const normalizedPath = libraryPath.replace(/\\\\/g, '\\');
        const steamappsPath = path.join(normalizedPath, 'steamapps');
        if (fs.existsSync(steamappsPath) && !folders.includes(steamappsPath)) {
          console.log('[GameDetector] Additional Steam library found:', steamappsPath);
          folders.push(steamappsPath);
        }
      }
    }
  } catch (error) {
    console.error('[GameDetector] Error parsing Steam library folders:', error);
  }

  console.log(`[GameDetector] Total Steam libraries found: ${folders.length}`);

  // Cache the result
  steamLibraryFoldersCache = { steamPath, folders };
  return folders;
}

// Cache for Steam games
let steamGamesCache: Map<string, string> | null = null;

/**
 * Invalidate the Steam games cache
 */
export function invalidateSteamGamesCache(): void {
  console.log('[GameDetector] Invalidating Steam games cache');
  steamGamesCache = null;
}

/**
 * Get all installed games from appmanifest files (with caching)
 */
function getAllSteamGames(libraryFolders: string[]): Map<string, string> {
  // Return cached value if available
  if (steamGamesCache !== null) {
    console.log(`[GameDetector] Using cached Steam games (${steamGamesCache.size} games)`);
    return steamGamesCache;
  }

  console.log('[GameDetector] Scanning Steam libraries for installed games...');
  const games = new Map<string, string>(); // installdir -> full path

  for (const folder of libraryFolders) {
    try {
      const files = fs.readdirSync(folder);
      const manifestFiles = files.filter(f => f.startsWith('appmanifest_') && f.endsWith('.acf'));

      for (const manifestFile of manifestFiles) {
        const manifestPath = path.join(folder, manifestFile);
        try {
          const content = fs.readFileSync(manifestPath, 'utf8');
          const manifest = parseAppManifest(content);

          if (manifest && manifest.installdir) {
            const gamePath = path.join(folder, 'common', manifest.installdir);
            if (fs.existsSync(gamePath)) {
              games.set(manifest.installdir.toLowerCase(), gamePath);
              console.log(`[GameDetector] Found game: ${manifest.name} (${manifest.installdir})`);
            }
          }
        } catch (err) {
          console.error(`[GameDetector] Error parsing manifest ${manifestFile}:`, err);
        }
      }
    } catch (err) {
      console.error(`[GameDetector] Error reading library folder ${folder}:`, err);
    }
  }

  // Cache the result
  steamGamesCache = games;
  return games;
}


/**
 * Find Steam game by folder name
 */
function findSteamGame(gameFolderName: string): string | null {
  console.log(`[GameDetector] Searching for Steam game: "${gameFolderName}"`);

  // Normalize the folder name - remove steamapps/common/ prefix if present
  const normalizedFolderName = gameFolderName
    .replace(/^steamapps[/\\]common[/\\]/i, '')
    .replace(/^common[/\\]/i, '');

  if (normalizedFolderName !== gameFolderName) {
    console.log(`[GameDetector] Normalized folder name: "${gameFolderName}" -> "${normalizedFolderName}"`);
  }

  const steamPath = getSteamPath();
  if (!steamPath) {
    console.warn('[GameDetector] Cannot search for game - Steam not found');
    return null;
  }

  const libraryFolders = getSteamLibraryFolders(steamPath);

  // First, try exact path matching (case-sensitive for accuracy)
  for (const folder of libraryFolders) {
    const commonPath = path.join(folder, 'common', normalizedFolderName);
    console.log(`[GameDetector] Checking path: ${commonPath}`);

    if (fs.existsSync(commonPath)) {
      console.log(`[GameDetector] ✓ Game found at: ${commonPath}`);
      return commonPath;
    }
  }

  // If not found, try parsing appmanifest files for more accurate detection
  console.log('[GameDetector] Exact match not found, scanning appmanifest files...');
  const installedGames = getAllSteamGames(libraryFolders);

  // Try EXACT match only (no fuzzy matching to avoid confusion)
  const gamePath = installedGames.get(normalizedFolderName.toLowerCase());
  if (gamePath) {
    // Verify the path basename matches exactly (case-insensitive)
    const actualBasename = path.basename(gamePath).toLowerCase();
    if (actualBasename === normalizedFolderName.toLowerCase()) {
      console.log(`[GameDetector] ✓ Game found via appmanifest: ${gamePath}`);
      return gamePath;
    } else {
      console.log(`[GameDetector] Path found but basename mismatch: expected "${normalizedFolderName}", got "${actualBasename}"`);
    }
  }

  // List available games for debugging
  console.log(`[GameDetector] Available games (${installedGames.size}):`, Array.from(installedGames.keys()).slice(0, 20));
  console.warn(`[GameDetector] ✗ Game "${gameFolderName}" not found in any Steam library`);
  return null;
}

/**
 * Detect GOG installation path
 */
function getGOGPath(): string | null {
  try {
    if (process.platform === 'win32') {
      try {
        const output = execSync(
          'reg query "HKEY_LOCAL_MACHINE\\SOFTWARE\\WOW6432Node\\GOG.com\\GalaxyClient\\paths" /v client',
          { encoding: 'utf8' }
        );
        const match = output.match(/client\s+REG_SZ\s+(.+)/);
        if (match && match[1]) {
          return path.dirname(match[1].trim());
        }
      } catch {
        // Fallback to default path
        const defaultPath = 'C:\\Program Files (x86)\\GOG Galaxy\\Games';
        if (fs.existsSync(defaultPath)) {
          return defaultPath;
        }
      }
    } else if (process.platform === 'darwin') {
      // Check for GOG Galaxy app
      const gogAppPath = '/Applications/GOG Galaxy.app';
      if (fs.existsSync(gogAppPath)) {
        // GOG Galaxy games are typically stored in user's Library
        const gamesPath = path.join(os.homedir(), 'Library/Application Support/GOG.com/Galaxy/Storage/galaxy-2.0/installed');
        if (fs.existsSync(gamesPath)) {
          return gamesPath;
        }
        // Fallback to common location
        const fallbackPath = path.join(os.homedir(), 'GOG Games');
        if (fs.existsSync(fallbackPath)) {
          return fallbackPath;
        }
      }
    }
  } catch (error) {
    console.error('Error detecting GOG path:', error);
  }
  return null;
}

/**
 * Detect Epic Games installation path
 */
function getEpicPath(): string | null {
  try {
    if (process.platform === 'win32') {
      // Epic Games stores manifests in ProgramData
      const manifestPath = 'C:\\ProgramData\\Epic\\EpicGamesLauncher\\Data\\Manifests';
      if (fs.existsSync(manifestPath)) {
        console.log('[GameDetector] Epic Games manifests found at:', manifestPath);
        return manifestPath;
      }
    } else if (process.platform === 'darwin') {
      // macOS: Epic Games manifests
      const manifestPath = path.join(os.homedir(), 'Library/Application Support/Epic/EpicGamesLauncher/Data/Manifests');
      if (fs.existsSync(manifestPath)) {
        console.log('[GameDetector] Epic Games manifests found at:', manifestPath);
        return manifestPath;
      }
    }
  } catch (error) {
    console.error('[GameDetector] Error detecting Epic path:', error);
  }
  console.warn('[GameDetector] Epic Games Launcher not found');
  return null;
}

/**
 * Find GOG game by folder name
 */
function findGOGGame(gameFolderName: string): string | null {
  const gogPath = getGOGPath();
  if (!gogPath) return null;

  const gamePath = path.join(gogPath, gameFolderName);
  if (fs.existsSync(gamePath)) {
    return gamePath;
  }

  return null;
}

/**
 * Parse Epic Games manifest file to get installation path
 */
function parseEpicManifest(manifestPath: string): { installLocation: string; displayName: string } | null {
  try {
    const content = fs.readFileSync(manifestPath, 'utf8');
    const manifest = JSON.parse(content);

    if (manifest.InstallLocation && manifest.DisplayName) {
      return {
        installLocation: manifest.InstallLocation,
        displayName: manifest.DisplayName,
      };
    }
  } catch (error) {
    console.error(`[GameDetector] Error parsing Epic manifest ${manifestPath}:`, error);
  }
  return null;
}

/**
 * Find Epic game by folder name or display name
 */
function findEpicGame(gameFolderName: string): string | null {
  console.log(`[GameDetector] Searching for Epic game: "${gameFolderName}"`);

  const epicManifestPath = getEpicPath();
  if (!epicManifestPath) {
    console.warn('[GameDetector] Cannot search for game - Epic Games Launcher not found');
    return null;
  }

  try {
    const manifestFiles = fs.readdirSync(epicManifestPath).filter(f => f.endsWith('.item'));

    for (const manifestFile of manifestFiles) {
      const manifestFullPath = path.join(epicManifestPath, manifestFile);
      const manifest = parseEpicManifest(manifestFullPath);

      if (manifest) {
        const installDirName = path.basename(manifest.installLocation);

        // Try to match by folder name (case-insensitive)
        if (installDirName.toLowerCase() === gameFolderName.toLowerCase()) {
          if (fs.existsSync(manifest.installLocation)) {
            console.log(`[GameDetector] ✓ Epic game found: ${manifest.displayName} at ${manifest.installLocation}`);
            return manifest.installLocation;
          }
        }
      }
    }

    console.warn(`[GameDetector] ✗ Epic game "${gameFolderName}" not found`);
  } catch (error) {
    console.error('[GameDetector] Error searching Epic games:', error);
  }

  return null;
}

/**
 * Detect all possible paths for a game
 */
export function detectGamePaths(installPaths: InstallPath[]): GamePath[] {
  const results: GamePath[] = [];

  for (const installPath of installPaths) {
    if (!installPath.type || !installPath.path) continue;

    let foundPath: string | null = null;

    if (installPath.type === 'steam') {
      foundPath = findSteamGame(installPath.path);
      results.push({
        platform: 'steam',
        path: foundPath || '',
        exists: !!foundPath,
      });
    } else if (installPath.type === 'gog') {
      foundPath = findGOGGame(installPath.path);
      results.push({
        platform: 'gog',
        path: foundPath || '',
        exists: !!foundPath,
      });
    } else if (installPath.type === 'epic') {
      foundPath = findEpicGame(installPath.path);
      results.push({
        platform: 'epic',
        path: foundPath || '',
        exists: !!foundPath,
      });
    } else if (installPath.type === 'emulator') {
      // Emulator requires manual path selection, skip auto-detection
      // Path will be empty until user selects it manually
      results.push({
        platform: 'emulator',
        path: '',
        exists: false,
      });
    }
  }

  return results;
}

/**
 * Get the first available game path
 */
export function getFirstAvailableGamePath(installPaths: InstallPath[]): GamePath | null {
  const paths = detectGamePaths(installPaths);
  return paths.find(p => p.exists) || null;
}

/**
 * Get all installed Steam games as a Map (installdir -> full path)
 * Returns the cached result or scans if cache is empty
 */
export function getAllInstalledSteamGames(): Map<string, string> {
  const steamPath = getSteamPath();
  if (!steamPath) {
    console.log('[GameDetector] Steam not found');
    return new Map();
  }

  const libraryFolders = getSteamLibraryFolders(steamPath);
  return getAllSteamGames(libraryFolders);
}

/**
 * Get all installed games on the system (Steam + GOG + Epic)
 * Returns a list of install paths that can be matched against database
 */
export function getAllInstalledGamePaths(): string[] {
  const installedPaths: string[] = [];

  // Get all Steam games
  try {
    const steamPath = getSteamPath();
    if (steamPath) {
      const libraryFolders = getSteamLibraryFolders(steamPath);
      const steamGames = getAllSteamGames(libraryFolders);

      // Add all install directories with 'steamapps/common/' prefix
      for (const [installdir] of steamGames.entries()) {
        installedPaths.push(`steamapps/common/${installdir}`);
        installedPaths.push(`common/${installdir}`);
        installedPaths.push(installdir);
      }
    }
  } catch (error) {
    console.error('[GameDetector] Error getting Steam games:', error);
  }

  // Get all GOG games
  try {
    const gogPath = getGOGPath();
    if (gogPath && fs.existsSync(gogPath)) {
      const gogGames = fs.readdirSync(gogPath);
      for (const game of gogGames) {
        const gamePath = path.join(gogPath, game);
        if (fs.statSync(gamePath).isDirectory()) {
          installedPaths.push(game);
        }
      }
    }
  } catch (error) {
    console.error('[GameDetector] Error getting GOG games:', error);
  }

  // Get all Epic Games
  try {
    const epicManifestPath = getEpicPath();
    if (epicManifestPath && fs.existsSync(epicManifestPath)) {
      const manifestFiles = fs.readdirSync(epicManifestPath).filter(f => f.endsWith('.item'));

      for (const manifestFile of manifestFiles) {
        const manifestFullPath = path.join(epicManifestPath, manifestFile);
        const manifest = parseEpicManifest(manifestFullPath);

        if (manifest && fs.existsSync(manifest.installLocation)) {
          const installDirName = path.basename(manifest.installLocation);
          installedPaths.push(installDirName);
        }
      }
    }
  } catch (error) {
    console.error('[GameDetector] Error getting Epic games:', error);
  }

  console.log(`[GameDetector] Found ${installedPaths.length} installed game paths on system`);
  return installedPaths;
}
