/**
 * GOG Galaxy Detection
 */

import Database from 'better-sqlite3';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { isLinux, isMacOS, isWindows } from '../utils/platform';
import {
  findGameInHeroicDirs,
  getAllHeroicGameFolders,
  getHeroicConfigPaths,
} from './heroic';

/**
 * GOG game info file structure (goggame-*.info)
 */
interface GOGGameInfoFile {
  gameId: string;
  rootGameId: string;
  name: string;
  buildId?: string;
  clientId?: string;
  standalone?: boolean;
  dependencyGameId?: string;
  language?: string;
  languages?: string[];
  playTasks?: Array<{
    type: string;
    path?: string;
    name?: string;
    isPrimary?: boolean;
  }>;
}

/**
 * Get GOG Galaxy database path
 */
function getGOGGalaxyDBPath(): string | null {
  try {
    if (isWindows()) {
      const localAppData = process.env.LOCALAPPDATA;
      if (localAppData) {
        const dbPath = path.join(localAppData, 'GOG.com/Galaxy/storage/galaxy-2.0.db');
        if (fs.existsSync(dbPath)) {
          return dbPath;
        }
      }
    } else if (isMacOS()) {
      const dbPath = path.join(
        os.homedir(),
        'Library/Application Support/GOG.com/Galaxy/Storage/galaxy-2.0.db'
      );
      if (fs.existsSync(dbPath)) {
        return dbPath;
      }
    }
  } catch (error) {
    console.warn('[GOG] Error getting Galaxy DB path:', error);
  }
  return null;
}

/**
 * Get common GOG game installation directories
 */
function getGOGGameDirs(): string[] {
  const dirs: string[] = [];
  const home = os.homedir();

  if (isWindows()) {
    // Common Windows GOG paths
    dirs.push('C:\\GOG Games');
    dirs.push('C:\\Program Files (x86)\\GOG Galaxy\\Games');
    dirs.push('C:\\Program Files\\GOG Galaxy\\Games');
    dirs.push(path.join(home, 'GOG Games'));

    // Check other drives
    for (const drive of ['D', 'E', 'F', 'G']) {
      dirs.push(`${drive}:\\GOG Games`);
      dirs.push(`${drive}:\\Games\\GOG`);
    }
  } else if (isMacOS()) {
    dirs.push(path.join(home, 'GOG Games'));
    dirs.push('/Applications/GOG Games');
    dirs.push(path.join(home, 'Library/Application Support/GOG.com/Galaxy/Games'));
  }

  return dirs.filter((dir) => fs.existsSync(dir));
}

/**
 * Read goggame-*.info file and extract game info
 */
function readGOGGameInfo(infoFilePath: string): GOGGameInfoFile | null {
  try {
    const content = fs.readFileSync(infoFilePath, 'utf8');
    return JSON.parse(content) as GOGGameInfoFile;
  } catch {
    return null;
  }
}

/**
 * Scan directory for goggame-*.info files and extract game titles
 */
function scanDirForGOGGames(dir: string): string[] {
  const titles: string[] = [];

  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      const gameDir = path.join(dir, entry.name);
      let infoDir = gameDir;

      // On macOS, info files are inside .app/Contents/Resources/
      if (isMacOS()) {
        const appBundles = fs.readdirSync(gameDir).filter((f) => f.endsWith('.app'));
        if (appBundles.length > 0) {
          const resourcesPath = path.join(gameDir, appBundles[0], 'Contents/Resources');
          if (fs.existsSync(resourcesPath)) {
            infoDir = resourcesPath;
          }
        }
      }

      // Find goggame-*.info files
      try {
        const files = fs.readdirSync(infoDir);
        for (const file of files) {
          if (file.match(/^goggame-\d+\.info$/)) {
            const info = readGOGGameInfo(path.join(infoDir, file));
            if (info?.name) {
              titles.push(info.name);
            }
          }
        }
      } catch {
        // Skip directories we can't read
      }
    }
  } catch (error) {
    console.warn(`[GOG] Error scanning dir ${dir}:`, error);
  }

  return titles;
}

/**
 * Get installed games from GOG Galaxy SQLite database
 */
function getGamesFromGalaxyDB(): string[] {
  const dbPath = getGOGGalaxyDBPath();
  if (!dbPath) return [];

  const titles: string[] = [];

  try {
    // Open database in readonly mode
    const db = new Database(dbPath, { readonly: true, fileMustExist: true });

    try {
      // Query installed games from InstalledBaseProducts table
      const rows = db
        .prepare(
          `
          SELECT DISTINCT p.title
          FROM InstalledBaseProducts ibp
          JOIN Products p ON ibp.productId = p.productId
          WHERE p.title IS NOT NULL
        `
        )
        .all() as Array<{ title: string }>;

      for (const row of rows) {
        if (row.title) {
          titles.push(row.title);
        }
      }
    } catch (queryError) {
      // Try alternative table structure (older Galaxy versions)
      try {
        const rows = db
          .prepare(
            `
            SELECT DISTINCT title
            FROM Products
            WHERE isInstalled = 1 AND title IS NOT NULL
          `
          )
          .all() as Array<{ title: string }>;

        for (const row of rows) {
          if (row.title) {
            titles.push(row.title);
          }
        }
      } catch {
        console.warn('[GOG] Could not query Galaxy database');
      }
    }

    db.close();
  } catch (error) {
    console.warn('[GOG] Error reading Galaxy database:', error);
  }

  return titles;
}

/**
 * Get GOG games from Windows Registry
 */
function getGamesFromRegistry(): string[] {
  if (!isWindows()) return [];

  const titles: string[] = [];

  try {
    // Query HKEY_LOCAL_MACHINE for GOG games
    const output = execSync(
      'reg query "HKEY_LOCAL_MACHINE\\SOFTWARE\\WOW6432Node\\GOG.com\\Games" /s 2>nul',
      { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 }
    );

    // Parse registry output for GAMENAME values
    const matches = output.matchAll(/GAMENAME\s+REG_SZ\s+(.+)/g);
    for (const match of matches) {
      const title = match[1].trim();
      if (title) {
        titles.push(title);
      }
    }
  } catch {
    // Registry key doesn't exist or access denied
  }

  return titles;
}

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

interface HeroicGogGame {
  install_path?: string;
  title?: string;
  [key: string]: unknown;
}

/**
 * Find GOG game by folder name
 */
export function findGOGGame(gameFolderName: string): string | null {
  // Linux (Heroic) support
  if (isLinux()) {
    // Check Heroic directories
    const heroicPath = findGameInHeroicDirs(gameFolderName);
    if (heroicPath) {
      console.log(`[GOG] ✓ Game found (Heroic): ${heroicPath}`);
      return heroicPath;
    }

    // Try parsing installed.json
    try {
      const configPaths = getHeroicConfigPaths().map((p) =>
        path.join(p, 'gog_store/installed.json')
      );

      for (const configPath of configPaths) {
        if (fs.existsSync(configPath)) {
          const content = fs.readFileSync(configPath, 'utf8');
          const games = JSON.parse(content);
          // Heroic GOG installed.json is usually an array of objects with install_path
          if (Array.isArray(games)) {
            const game = games.find((g: HeroicGogGame) => {
              const installPath = g.install_path;
              if (installPath) {
                return path.basename(installPath) === gameFolderName;
              }
              return false;
            });

            if (game && game.install_path && fs.existsSync(game.install_path)) {
              console.log(`[GOG] ✓ Game found via installed.json: ${game.install_path}`);
              return game.install_path;
            }
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
      // Get all game folders from Heroic directories
      paths.push(...getAllHeroicGameFolders());

      // Read from installed.json as well
      try {
        const configPaths = getHeroicConfigPaths().map((p) =>
          path.join(p, 'gog_store/installed.json')
        );

        for (const configPath of configPaths) {
          if (fs.existsSync(configPath)) {
            const content = fs.readFileSync(configPath, 'utf8');
            const games = JSON.parse(content);
            if (Array.isArray(games)) {
              for (const game of games as HeroicGogGame[]) {
                if (game.install_path && fs.existsSync(game.install_path)) {
                  paths.push(path.basename(game.install_path));
                }
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
 * Get all GOG games (installed/owned)
 * Returns array of game titles
 */
export function getGogLibrary(): string[] {
  const titles = new Set<string>();

  // Linux: Use Heroic launcher data
  if (isLinux()) {
    const configPaths = getHeroicConfigPaths().map((p) =>
      path.join(p, 'store_cache/gog_library.json')
    );

    try {
      for (const configPath of configPaths) {
        if (fs.existsSync(configPath)) {
          const content = fs.readFileSync(configPath, 'utf8');
          const data = JSON.parse(content);

          // GOG library structure: { games: [...] }
          const games = Array.isArray(data) ? data : data.games || [];

          if (Array.isArray(games)) {
            for (const game of games as HeroicGogGame[]) {
              if (game.title) {
                titles.add(game.title);
              }
            }
          }
        }
      }
    } catch (error) {
      console.error('[GOG] Error reading Heroic library:', error);
    }
  }

  // Windows/macOS: Use native GOG Galaxy detection
  if (isWindows() || isMacOS()) {
    // Method 1: GOG Galaxy SQLite database
    const dbTitles = getGamesFromGalaxyDB();
    for (const title of dbTitles) {
      titles.add(title);
    }

    // Method 2: Scan goggame-*.info files in common directories
    const gogDirs = getGOGGameDirs();
    for (const dir of gogDirs) {
      const scannedTitles = scanDirForGOGGames(dir);
      for (const title of scannedTitles) {
        titles.add(title);
      }
    }

    // Method 3: Windows Registry (Windows only)
    if (isWindows()) {
      const registryTitles = getGamesFromRegistry();
      for (const title of registryTitles) {
        titles.add(title);
      }
    }
  }

  const result = Array.from(titles);
  if (result.length > 0) {
    console.log(`[GOG] Found ${result.length} games in library`);
  }

  return result;
}
