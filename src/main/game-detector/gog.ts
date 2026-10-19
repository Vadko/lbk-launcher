/**
 * GOG Galaxy Detection
 */

import { F } from '@mobily/ts-belt';
import Database from 'better-sqlite3';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { HKEY } from 'registry-js';
import { isLinux, isMacOS, isWindows } from '../utils/platform';
import { getRegistryString } from '../utils/registry';
import { getCleanTitle } from './game-titles';
import { getHeroicConfigPaths } from './heroic';
import { logIfChanged } from './log-if-changed';
import { getLutrisGOGDirs, getLutrisGogLibrary } from './lutris';

const GOG_DB_FILENAME = 'galaxy-2.0.db';

interface GOGInstalledGame {
  productId?: number;
  title?: string;
  slug?: string;
  installationPath?: string;
}

/** Where GOG Galaxy keeps its database on this OS, whether or not Galaxy is installed */
export function getGOGGalaxyDBCandidatePath(): string | null {
  if (isWindows()) {
    const programData = process.env.PROGRAMDATA;
    return programData
      ? path.join(programData, 'GOG.com', 'Galaxy', 'storage', GOG_DB_FILENAME)
      : null;
  }
  if (isMacOS()) {
    return path.join(
      os.homedir(),
      'Library/Application Support/GOG.com/Galaxy/Storage',
      GOG_DB_FILENAME
    );
  }
  return null;
}

/**
 * Get GOG Galaxy database path
 */
function getGOGGalaxyDBPath(): string | null {
  try {
    const dbPath = getGOGGalaxyDBCandidatePath();
    if (dbPath && fs.existsSync(dbPath)) {
      return dbPath;
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
  if (!dbPath) {
    return [];
  }

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
  if (!dbPath) {
    return [];
  }

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

  return dbData
    .filter((g) => g.title != null)
    .map((g) => getCleanTitle(g.title!.trim()))
    .filter((t) => t);
}

/**
 * Get GOG Galaxy client executable path
 */
export function getGOGGalaxyClientPath(): string | null {
  try {
    if (isWindows()) {
      const clientDir = getRegistryString(
        HKEY.HKEY_LOCAL_MACHINE,
        'SOFTWARE\\WOW6432Node\\GOG.com\\GalaxyClient\\paths',
        'client'
      );
      const clientPath = clientDir ? path.join(clientDir, 'GalaxyClient.exe') : null;
      if (clientPath && fs.existsSync(clientPath)) {
        return clientPath;
      }
      const defaultPath = 'C:\\Program Files (x86)\\GOG Galaxy\\GalaxyClient.exe';
      if (fs.existsSync(defaultPath)) {
        return defaultPath;
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
  if (!isLinux()) {
    return null;
  }

  try {
    const game = readHeroicGogInstalled().find(
      (g) => g.install_path && path.resolve(g.install_path) === path.resolve(gamePath)
    );
    // Fallback: use ID from installed.json if appName is missing
    return game?.appName ?? game?.id ?? null;
  } catch (error) {
    console.error('[GOG] Error getting Heroic ID:', error);
  }

  return null;
}

interface HeroicGogGame {
  appName?: string;
  app_name?: string;
  id?: string;
  install_path?: string;
  title?: string;
  is_dlc?: boolean;
  [key: string]: unknown;
}

const isHeroicGogGame = (value: unknown): value is HeroicGogGame =>
  typeof value === 'object' && value !== null;

// Heroic writes gog_store/installed.json as { installed: [...] } (older versions: a bare array) and leaves out titles
function readHeroicGogInstalled(): HeroicGogGame[] {
  const installed: HeroicGogGame[] = [];
  for (const root of getHeroicConfigPaths()) {
    const configPath = path.join(root, 'gog_store/installed.json');
    if (!fs.existsSync(configPath)) {
      continue;
    }
    try {
      const data: unknown = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      const list = Array.isArray(data)
        ? data
        : isHeroicGogGame(data) && Array.isArray(data.installed)
          ? data.installed
          : [];
      installed.push(...list.filter(isHeroicGogGame));
    } catch (error) {
      console.warn(`[GOG] Error reading ${configPath}:`, error);
    }
  }
  return installed;
}

// gog_library.json can be several MB, so titles are only joined in for the callers that match by title
function withHeroicGogTitles(installed: HeroicGogGame[]): HeroicGogGame[] {
  if (installed.every((game) => game.title)) {
    return installed;
  }
  const titles = readHeroicGogTitles();
  return installed.map((game) =>
    game.title || !game.appName ? game : { ...game, title: titles.get(game.appName) }
  );
}

function readHeroicGogLibrary(): HeroicGogGame[] {
  const games: HeroicGogGame[] = [];
  for (const root of getHeroicConfigPaths()) {
    const configPath = path.join(root, 'store_cache/gog_library.json');
    if (!fs.existsSync(configPath)) {
      continue;
    }
    try {
      const data: unknown = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      const list = Array.isArray(data)
        ? data
        : isHeroicGogGame(data) && Array.isArray(data.games)
          ? data.games
          : [];
      games.push(...list.filter(isHeroicGogGame));
    } catch (error) {
      console.error(`[GOG] Error reading ${configPath}:`, error);
    }
  }
  return games;
}

function readHeroicGogTitles(): Map<string, string> {
  const titles = new Map<string, string>();
  for (const game of readHeroicGogLibrary()) {
    if (game.app_name && game.title) {
      titles.set(game.app_name, game.title);
    }
  }
  return titles;
}

/** Folder names of GOG games Heroic has installed, so the Epic side can skip them in the shared Heroic dir */
export function getHeroicGogInstallFolders(): string[] {
  return readHeroicGogInstalled()
    .filter(
      (game) => game.install_path && !game.is_dlc && fs.existsSync(game.install_path)
    )
    .map((game) => path.basename(game.install_path as string));
}

/**
 * Find GOG game by folder name
 */
export function findGOGGame(gameFolderName: string): string | null {
  // One lookup parses gog_library.json at most once, shared by the title match and the fallback scan
  const installed = readHeroicGogInstalled();
  const titled = F.once(() => withHeroicGogTitles(installed));

  if (isLinux()) {
    // Helper to normalize strings for comparison (remove special chars, lowercase)
    const normalize = (str: string) => str.toLowerCase().replace(/[^a-z0-9]/g, '');
    const targetFolder = normalize(gameFolderName);

    // installed.json first: Epic games share Heroic's install dir, so a bare folder match there can't tell the stores apart
    try {
      const matchesFolder = (g: HeroicGogGame) =>
        !!g.install_path &&
        (path.basename(g.install_path) === gameFolderName ||
          normalize(path.basename(g.install_path)) === targetFolder);
      const game =
        installed.find(matchesFolder) ??
        titled().find((g) => !!g.title && normalize(g.title) === targetFolder);

      if (game?.install_path && fs.existsSync(game.install_path)) {
        console.log(`[GOG] ✓ Game found via installed.json: ${game.install_path}`);
        return game.install_path;
      }
    } catch (e) {
      console.warn('[GOG] Error checking Heroic config:', e);
    }

    // Lutris GOG directories (fuzzy match)
    for (const dir of getLutrisGOGDirs()) {
      try {
        for (const subdir of fs.readdirSync(dir)) {
          if (normalize(subdir) === targetFolder) {
            const fullPath = path.join(dir, subdir);
            if (fs.statSync(fullPath).isDirectory()) {
              console.log(`[GOG] ✓ Game found (Lutris fuzzy): ${fullPath}`);
              return fullPath;
            }
          }
        }
      } catch {
        // Safe to ignore
      }
    }
  }

  const installedGames = getAllInstalledGOGGames(titled());

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
      // Get game folders from Lutris directories (each subdir in drive_c/GOG Games is a game installation)
      for (const dir of getLutrisGOGDirs()) {
        try {
          paths.push(...fs.readdirSync(dir));
        } catch {
          // Safe to ignore
        }
      }

      // Heroic's installed.json lists GOG installs wherever they live, custom install dirs included
      for (const game of readHeroicGogInstalled()) {
        if (game.install_path && fs.existsSync(game.install_path)) {
          paths.push(path.basename(game.install_path));
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

  if (paths.length > 0) {
    logIfChanged(
      'gog-installed',
      `[GOG] Found ${paths.length} installed games: ${paths.join(', ')}`
    );
  }

  return paths;
}

/**
 * Get all installed GOG games with their paths
 * Returns Map<title, installationPath>
 * Similar to getAllInstalledSteamGames()
 */
function getAllInstalledGOGGames(heroicGames: HeroicGogGame[]): Map<string, string> {
  const gamesMap = new Map<string, string>();

  if (isLinux()) {
    for (const game of heroicGames) {
      if (game.title && game.install_path && fs.existsSync(game.install_path)) {
        gamesMap.set(getCleanTitle(game.title).toLowerCase(), game.install_path);
      }
    }

    // Include Lutris GOG installations mapped via db directly (we can leverage fuzzy matching folders too)
    for (const dir of getLutrisGOGDirs()) {
      try {
        for (const subdir of fs.readdirSync(dir)) {
          const gamePath = path.join(dir, subdir);
          if (fs.statSync(gamePath).isDirectory()) {
            gamesMap.set(getCleanTitle(subdir).toLowerCase(), gamePath);
          }
        }
      } catch {
        // Safe to ignore
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
    const allTitles = readHeroicGogLibrary()
      .map((g) => (g.title ? getCleanTitle(g.title) : null))
      .filter((title): title is string => !!title);

    const result = [...new Set([...allTitles, ...getLutrisGogLibrary()])];
    if (result.length > 0) {
      logIfChanged(
        'gog-library',
        `[GOG] Found ${result.length} games in Heroic/Lutris library`
      );
    }
    return result;
  }

  // Windows/macOS: Use native GOG Galaxy detection
  const result = getAllGamesFromGalaxyDB();

  if (result.length > 0) {
    logIfChanged(
      'gog-library',
      `[GOG] Found ${result.length} games in GOG Galaxy DB: ${result.join(', ')}`
    );
  }

  return result;
}
