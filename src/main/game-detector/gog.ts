/**
 * GOG Galaxy Detection
 */

import Database from 'better-sqlite3';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { isLinux, isMacOS, isWindows } from '../utils/platform';
import { getCleanTitle } from './game-titles';
import {
  getAllHeroicGameFolders,
  getHeroicConfigPaths,
  getHeroicGamePaths,
} from './heroic';

const GOG_DB_FILENAME = 'galaxy-2.0.db';

interface GOGInstalledGame {
  productId?: number;
  title?: string;
  slug?: string;
  installationPath?: string;
}

/**
 * Get GOG Galaxy database path
 */
function getGOGGalaxyDBPath(): string | null {
  try {
    if (isWindows()) {
      const programData = process.env.PROGRAMDATA;
      if (programData) {
        const dbPath = path.join(
          programData,
          'GOG.com',
          'Galaxy',
          'storage',
          GOG_DB_FILENAME
        );
        if (fs.existsSync(dbPath)) {
          return dbPath;
        }
      }
    } else if (isMacOS()) {
      const dbPath = path.join(
        os.homedir(),
        'Library/Application Support/GOG.com/Galaxy/Storage',
        GOG_DB_FILENAME
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
 * Get installed games from GOG Galaxy SQLite database
 */
function getInstalledGamesFromGalaxyDB(): GOGInstalledGame[] {
  const dbPath = getGOGGalaxyDBPath();
  if (!dbPath) return [];

  let dbData: GOGInstalledGame[] = [];

  try {
    // Open database in readonly mode
    const db = new Database(dbPath, { readonly: true, fileMustExist: true });

    try {
      // Query installed games from InstalledBaseProducts table
      dbData = db
        .prepare(
          `
          SELECT
            pdv.productId,
            pdv.title,
            pdv.slug,
            ibp.installationPath
          FROM InstalledBaseProducts ibp
          JOIN "Product Details View" pdv
            ON ibp.productId = pdv.productId
          WHERE pdv.title IS NOT NULL;
        `
        )
        .all() as Array<GOGInstalledGame>;
    } catch (queryError) {
      // Try alternative table structure (older Galaxy versions)
      try {
        dbData = db
          .prepare(
            `
            SELECT DISTINCT title
            FROM Products
            WHERE isInstalled = 1 AND title IS NOT NULL
          `
          )
          .all() as Array<{ title: string }>;
      } catch {
        console.warn('[GOG] Could not query Galaxy database');
      }
    } finally {
      db.close();
    }
  } catch (error) {
    console.warn('[GOG] Error reading Galaxy database:', error);
  }

  return dbData;
}

/**
 * Get all games from GOG Galaxy SQLite database
 */
function getAllGamesFromGalaxyDB(): string[] {
  const dbPath = getGOGGalaxyDBPath();
  if (!dbPath) return [];

  let dbData: GOGInstalledGame[] = [];

  try {
    // Open database in readonly mode
    const db = new Database(dbPath, { readonly: true, fileMustExist: true });

    try {
      // Query all games from library
      dbData = db
        .prepare(
          `
          SELECT
            CAST(SUBSTR(gp.releaseKey, 5) AS INTEGER) AS id,
            json_extract(gp.value, '$.title') AS title
          FROM GamePieces gp
          JOIN GamePieceTypes gpt
            ON gp.gamePieceTypeId = gpt.id
          JOIN Products p
            ON CAST(SUBSTR(gp.releaseKey, 5) AS INTEGER) = p.id
          WHERE gp.releaseKey LIKE 'gog_%'
            AND gpt.type = 'originalTitle';
        `
        )
        .all() as Array<GOGInstalledGame>;
    } catch (queryError) {
      console.warn('[GOG] Could not query Galaxy database');
    }

    db.close();
  } catch (error) {
    console.warn('[GOG] Error reading Galaxy database:', error);
  }

  return dbData.map((g) => getCleanTitle(g.title!.trim())).filter((t) => t);
}

/**
 * Get GOG Galaxy client executable path
 */
export function getGOGGalaxyClientPath(): string | null {
  try {
    if (isWindows()) {
      try {
        const output = execSync(
          'reg query "HKEY_LOCAL_MACHINE\\SOFTWARE\\WOW6432Node\\GOG.com\\GalaxyClient\\paths" /v client',
          { encoding: 'utf8' }
        );
        const match = output.match(/client\s+REG_SZ\s+(.+)/);
        if (match?.[1]) {
          const clientPath = path.join(match[1].trim(), 'GalaxyClient.exe');
          if (fs.existsSync(clientPath)) {
            return clientPath;
          }
        }
      } catch {
        // Try default path
        const defaultPath = 'C:\\Program Files (x86)\\GOG Galaxy\\GalaxyClient.exe';
        if (fs.existsSync(defaultPath)) {
          return defaultPath;
        }
      }
    } else if (isMacOS()) {
      const appPath = path.join(
        '/Applications/GOG Galaxy.app/Contents/MacOS/GOG Galaxy',
        'GalaxyClient.exe'
      );
      if (fs.existsSync(appPath)) {
        return appPath;
      }
    }
  } catch (error) {
    console.error('[GOG] Error detecting Galaxy client path:', error);
  }

  return null;
}

/**
 * Get GOG game ID (productId) by installation path
 */
export function getGOGGameId(gamePath: string): number | null {
  const installedGames = getInstalledGamesFromGalaxyDB();

  for (const game of installedGames) {
    if (game.installationPath && game.installationPath === gamePath && game.productId) {
      return game.productId;
    }
  }

  return null;
}

/**
 * Get GOG Game ID from Heroic config by path
 */
export function getHeroicGOGId(gamePath: string): string | null {
  if (!isLinux()) return null;

  try {
    const configPaths = getHeroicConfigPaths().map((p) =>
      path.join(p, 'gog_store/installed.json')
    );

    for (const configPath of configPaths) {
      if (!fs.existsSync(configPath)) continue;

      const content = fs.readFileSync(configPath, 'utf8');
      const data = JSON.parse(content);
      const games = Array.isArray(data) ? data : data.installed || [];

      if (Array.isArray(games)) {
        const game = games.find((g: HeroicGogGame) => {
          return (
            g.install_path && path.resolve(g.install_path) === path.resolve(gamePath)
          );
        });

        if (game && game.appName) {
          return game.appName as string;
        }
        // Fallback: use ID from installed.json if appName is missing
        if (game && game.id) {
          return game.id as string;
        }
      }
    }
  } catch (error) {
    console.error('[GOG] Error getting Heroic ID:', error);
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
    // Helper to normalize strings for comparison (remove special chars, lowercase)
    const normalize = (str: string) => str.toLowerCase().replace(/[^a-z0-9]/g, '');
    const targetFolder = normalize(gameFolderName);

    // Check Heroic directories (fuzzy match)
    const heroicDirs = [
      ...getHeroicGamePaths(), // Flatpak + Native
      // Add other possible library paths if needed (usually handled by getHeroicGamePaths)
    ];

    for (const dir of heroicDirs) {
      if (!fs.existsSync(dir)) continue;
      try {
        const subdirs = fs.readdirSync(dir);
        for (const subdir of subdirs) {
          if (normalize(subdir) === targetFolder) {
            const fullPath = path.join(dir, subdir);
            if (fs.statSync(fullPath).isDirectory()) {
              console.log(`[GOG] ✓ Game found (Heroic fuzzy): ${fullPath}`);
              return fullPath;
            }
          }
        }
      } catch {
        // Safe to ignore
      }
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
                // Try exact basename match
                if (path.basename(installPath) === gameFolderName) return true;
                // Try normalized match
                if (normalize(path.basename(installPath)) === targetFolder) return true;
              }
              // Try normalized title match if folder name matches title
              if (g.title && normalize(g.title) === targetFolder) return true;
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

  // Get all installed GOG games with their full paths
  const installedGames = getAllInstalledGOGGames();

  // Search through all installed games by folder name
  for (const [, gamePath] of installedGames) {
    const folderName = path.basename(gamePath);
    if (folderName === gameFolderName) {
      console.log(`[GOG] ✓ Game found: ${gamePath}`);
      return gamePath;
    }
  }

  console.log(`[GOG] ✗ Game not found: ${gameFolderName}`);
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
      const configPaths = getHeroicConfigPaths().map((p) =>
        path.join(p, 'gog_store/installed.json')
      );

      for (const configPath of configPaths) {
        if (!fs.existsSync(configPath)) continue;

        try {
          const content = fs.readFileSync(configPath, 'utf8');
          const games = JSON.parse(content);
          if (Array.isArray(games)) {
            for (const game of games as HeroicGogGame[]) {
              if (game.install_path && fs.existsSync(game.install_path)) {
                paths.push(path.basename(game.install_path));
              }
            }
          }
        } catch (e) {
          console.warn(`[GOG] Error reading ${configPath}:`, e);
        }
      }
    }
    // Windows/macOS
    else {
      const installedGames = getInstalledGamesFromGalaxyDB();
      for (const game of installedGames) {
        if (game.installationPath) {
          paths.push(path.basename(game.installationPath));
        }
      }
    }
  } catch (error) {
    console.error('[GOG] Error getting game paths:', error);
  }

  return paths;
}

/**
 * Get all installed GOG games with their paths
 * Returns Map<title, installationPath>
 * Similar to getAllInstalledSteamGames()
 */
function getAllInstalledGOGGames(): Map<string, string> {
  const gamesMap = new Map<string, string>();

  // Linux: Use Heroic launcher data
  if (isLinux()) {
    const configPaths = getHeroicConfigPaths().map((p) =>
      path.join(p, 'gog_store/installed.json')
    );

    for (const configPath of configPaths) {
      if (!fs.existsSync(configPath)) continue;

      try {
        const content = fs.readFileSync(configPath, 'utf8');
        const games = JSON.parse(content);

        if (Array.isArray(games)) {
          for (const game of games as HeroicGogGame[]) {
            if (game.title && game.install_path && fs.existsSync(game.install_path)) {
              gamesMap.set(getCleanTitle(game.title).toLowerCase(), game.install_path);
            }
          }
        }
      } catch (error) {
        console.error(`[GOG] Error reading ${configPath}:`, error);
      }
    }
  }
  // Windows/macOS: Use native GOG Galaxy detection
  else if (isWindows() || isMacOS()) {
    const installedGames = getInstalledGamesFromGalaxyDB();

    for (const game of installedGames) {
      if (game.title && game.installationPath && fs.existsSync(game.installationPath)) {
        gamesMap.set(getCleanTitle(game.title).toLowerCase(), game.installationPath);
      }
    }
  }

  if (gamesMap.size > 0) {
    console.log(`[GOG] Found ${gamesMap.size} installed games with paths`);
  }

  return gamesMap;
}

/**
 * Get all GOG games (installed/owned)
 * Returns array of game titles
 */
export function getGogLibrary(): string[] {
  // Linux: Use Heroic launcher data
  if (isLinux()) {
    const configPaths = getHeroicConfigPaths().map((p) =>
      path.join(p, 'store_cache/gog_library.json')
    );

    const allTitles: string[] = [];

    for (const configPath of configPaths) {
      if (!fs.existsSync(configPath)) continue;

      try {
        const content = fs.readFileSync(configPath, 'utf8');
        const data = JSON.parse(content);
        const games = Array.isArray(data) ? data : data.games || [];

        if (Array.isArray(games)) {
          allTitles.push(
            ...games
              .map((g: HeroicGogGame) => (g.title ? getCleanTitle(g.title) : null))
              .filter((title): title is string => !!title)
          );
        }
      } catch (error) {
        console.error(`[GOG] Error reading ${configPath}:`, error);
      }
    }

    const result = [...new Set(allTitles)];
    if (result.length > 0) {
      console.log(`[GOG] Found ${result.length} games in Heroic library`);
    }
    return result;
  }

  // Windows/macOS: Use native GOG Galaxy detection
  const result = getAllGamesFromGalaxyDB();

  if (result.length > 0) {
    console.log(`[GOG] Found ${result.length} games in GOG Galaxy DB`);
  }

  return result;
}
