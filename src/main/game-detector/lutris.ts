/**
 * Lutris Games Detection
 */

import Database from 'better-sqlite3';
import * as fs from 'fs';
import { LRUCache } from 'lru-cache';
import * as os from 'os';
import * as path from 'path';
import { isLinux } from '../utils/platform';
import { getCleanTitle } from './game-titles';

/** Lutris database locations (native + Flatpak), whether or not Lutris is installed */
export function getLutrisDBCandidatePaths(): string[] {
  if (!isLinux()) {
    return [];
  }

  const home = os.homedir();
  return [
    path.join(home, '.local/share/lutris/pga.db'),
    path.join(home, '.var/app/net.lutris.Lutris/data/lutris/pga.db'),
  ];
}

/**
 * Get Lutris database paths (native + Flatpak)
 */
function getLutrisDBPath(): string | null {
  for (const dbPath of getLutrisDBCandidatePaths()) {
    if (fs.existsSync(dbPath)) {
      return dbPath;
    }
  }

  return null;
}

// max: 1, so a DB found at another path evicts and closes the previous handle
const connections = new LRUCache<string, Database.Database>({
  max: 1,
  memoMethod: (dbPath) => new Database(dbPath, { readonly: true, fileMustExist: true }),
  dispose: (db) => db.close(),
});

function query<T>(sql: string): T[] {
  const dbPath = getLutrisDBPath();
  if (!dbPath) {
    connections.clear();
    return [];
  }
  try {
    return connections.memo(dbPath).prepare(sql).all() as T[];
  } catch (error) {
    console.error(`[Lutris] Database query failed: ${sql}`, error);
    return [];
  }
}

interface LutrisGame {
  name: string;
  directory: string;
  service_id: string;
  slug: string;
  details?: string;
}

interface EpicGameDetails extends Record<string, unknown> {
  appName?: string;
  customAttributes?: {
    FolderName?: {
      value?: string;
    };
  };
}

function parseEpicDetails(json: string): EpicGameDetails | null {
  try {
    const parsed: unknown = JSON.parse(json);
    return parsed && typeof parsed === 'object' ? (parsed as EpicGameDetails) : null;
  } catch {
    return null;
  }
}

/**
 * Get installed GOG games from Lutris
 * Returns their Wine prefix with /drive_c/GOG Games appended, and the appname
 */
function getLutrisGOGInstallations(): Array<{
  path: string;
  appName: string;
  slug: string;
}> {
  const results: Array<{ path: string; appName: string; slug: string }> = [];

  const dbGames = query<LutrisGame>(
    `SELECT name, directory, service_id, slug FROM games WHERE service='gog'`
  );

  for (const game of dbGames) {
    if (game.directory) {
      const gamePrefixPath = path.join(game.directory, 'drive_c/GOG Games');
      if (fs.existsSync(gamePrefixPath)) {
        // Usually Lutris subdirectories in GOG Games are named after the game
        try {
          const subdirs = fs.readdirSync(gamePrefixPath);
          for (const subdir of subdirs) {
            const fullPath = path.join(gamePrefixPath, subdir);
            if (fs.statSync(fullPath).isDirectory()) {
              results.push({
                path: fullPath,
                appName: game.service_id,
                slug: game.slug,
              });
            }
          }
        } catch (e) {
          console.warn(`[Lutris] Error reading GOG prefix ${gamePrefixPath}:`, e);
        }
      }
    }
  }

  return results;
}

/**
 * Get installed Epic games from Lutris
 * Returns their installation path and the appName
 */
function getLutrisEpicInstallations(): Array<{
  path: string;
  appName: string;
  slug: string;
}> {
  const results: Array<{ path: string; appName: string; slug: string }> = [];

  const dbGames = query<LutrisGame>(`
    SELECT g.name, g.directory, g.service_id, g.slug, sg.details
    FROM games g
    LEFT JOIN service_games sg ON g.service_id = sg.appid
    WHERE g.service='egs'
  `);

  for (const game of dbGames) {
    if (game.directory && game.details) {
      const details = parseEpicDetails(game.details);
      if (!details) {
        console.warn(`[Lutris] Invalid JSON in details for ${game.name}`);
        continue;
      }

      // Epic details often have 'FolderName', or 'appName'
      let folderName = details.customAttributes?.FolderName?.value;
      // E.g 'DarkestDungeon'

      if (!folderName && details.appName) {
        folderName = details.appName;
      }

      if (folderName) {
        const gamePath = path.join(
          game.directory,
          'drive_c/Program Files/Epic Games',
          folderName
        );
        if (fs.existsSync(gamePath)) {
          results.push({
            path: gamePath,
            appName: details.appName || game.service_id,
            slug: game.slug,
          });
        }
      }
    }
  }

  return results;
}

/**
 * Public functions specifically matching what Heroic provides
 */

export function getLutrisGOGDirs(): string[] {
  // We return unique GOG Games directories paths
  // e.g. /home/user/Games/gog/game_prefix/drive_c/GOG Games
  const dirs = new Set<string>();

  const dbGames = query<{ directory: string }>(
    `SELECT directory FROM games WHERE service='gog'`
  );

  for (const game of dbGames) {
    if (game.directory) {
      const gamePrefixPath = path.join(game.directory, 'drive_c/GOG Games');
      if (fs.existsSync(gamePrefixPath)) {
        dirs.add(gamePrefixPath);
      }
    }
  }

  return Array.from(dirs);
}

export function getLutrisEpicGameDirNames(): string[] {
  const installs = getLutrisEpicInstallations();
  return installs.map((i) => path.basename(i.path));
}

export function getLutrisSlug(gamePath: string): string | null {
  const resolved = path.resolve(gamePath);
  const allInstalls = [...getLutrisGOGInstallations(), ...getLutrisEpicInstallations()];
  const found = allInstalls.find((i) => path.resolve(i.path) === resolved);
  return found ? found.slug : null;
}

/**
 * Provide complete Lutris GOG Library
 */
export function getLutrisGogLibrary(): string[] {
  const titles = new Set<string>();

  const dbGames = query<{ name: string }>(`SELECT name FROM games WHERE service='gog'`);

  for (const game of dbGames) {
    if (game.name) {
      titles.add(getCleanTitle(game.name.trim()));
    }
  }

  return Array.from(titles);
}

/**
 * Provide complete Lutris Epic Library
 */
export function getLutrisEpicLibrary(): string[] {
  const titles = new Set<string>();

  // Use UNION DISTINCT to prevent duplicates from both tables
  const dbGames = query<{ name: string }>(`
    SELECT DISTINCT name FROM (
      SELECT name FROM games WHERE service='egs'
      UNION
      SELECT name FROM service_games WHERE service='egs'
    )
  `);

  for (const game of dbGames) {
    if (game.name) {
      titles.add(getCleanTitle(game.name.trim()));
    }
  }

  return Array.from(titles);
}

/**
 * Full installed path maps for exact matching
 * Note: This is a direct alias to getLutrisEpicInstallations for backwards compatibility
 */
export function getLutrisInstalledEpicPathsFull(): {
  path: string;
  appName: string;
  slug: string;
}[] {
  return getLutrisEpicInstallations();
}
