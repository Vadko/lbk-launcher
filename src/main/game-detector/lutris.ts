/**
 * Lutris Games Detection
 */

import Database from 'better-sqlite3';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { isLinux } from '../utils/platform';
import { getCleanTitle } from './game-titles';

/**
 * Get Lutris database paths (native + Flatpak)
 */
function getLutrisDBPath(): string | null {
  if (!isLinux()) return null;

  const home = os.homedir();
  const possiblePaths = [
    path.join(home, '.local/share/lutris/pga.db'),
    path.join(home, '.var/app/net.lutris.Lutris/data/lutris/pga.db'),
  ];

  for (const dbPath of possiblePaths) {
    if (fs.existsSync(dbPath)) {
      return dbPath;
    }
  }

  return null;
}

interface LutrisGame {
  name: string;
  directory: string;
  service_id: string;
  slug: string;
  details?: string;
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
  const dbPath = getLutrisDBPath();
  if (!dbPath) return [];

  const results: Array<{ path: string; appName: string; slug: string }> = [];

  try {
    const db = new Database(dbPath, { readonly: true, fileMustExist: true });

    try {
      // Get all GOG games
      const dbGames = db
        .prepare(
          `SELECT name, directory, service_id, slug FROM games WHERE service='gog'`
        )
        .all() as LutrisGame[];

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
              // Ignore errors reading subdirs
            }
          }
        }
      }
    } finally {
      db.close();
    }
  } catch (error) {
    console.error('[Lutris] Error reading GOG games from database:', error);
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
  const dbPath = getLutrisDBPath();
  if (!dbPath) return [];

  const results: Array<{ path: string; appName: string; slug: string }> = [];

  try {
    const db = new Database(dbPath, { readonly: true, fileMustExist: true });

    try {
      // Get all Epic games with their details
      const dbGames = db
        .prepare(
          `
          SELECT g.name, g.directory, g.service_id, g.slug, sg.details 
          FROM games g 
          LEFT JOIN service_games sg ON g.service_id = sg.appid 
          WHERE g.service='egs'
          `
        )
        .all() as LutrisGame[];

      for (const game of dbGames) {
        if (game.directory && game.details) {
          try {
            const details = JSON.parse(game.details);
            // Epic details often have 'FolderName', or 'appName'
            let folderName = details?.customAttributes?.FolderName?.value;
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
          } catch (e) {
            console.warn('[Lutris] Error parsing Epic game details', e);
          }
        }
      }
    } finally {
      db.close();
    }
  } catch (error) {
    console.error('[Lutris] Error reading Epic games from database:', error);
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
  const dbPath = getLutrisDBPath();
  if (!dbPath) return [];

  try {
    const db = new Database(dbPath, { readonly: true, fileMustExist: true });

    try {
      const dbGames = db
        .prepare(`SELECT directory FROM games WHERE service='gog'`)
        .all() as { directory: string }[];

      for (const game of dbGames) {
        if (game.directory) {
          const gamePrefixPath = path.join(game.directory, 'drive_c/GOG Games');
          if (fs.existsSync(gamePrefixPath)) {
            dirs.add(gamePrefixPath);
          }
        }
      }
    } finally {
      db.close();
    }
  } catch (error) {
    console.error('[Lutris] Error reading database for GOG dirs:', error);
  }

  return Array.from(dirs);
}

export function getLutrisEpicGamePaths(): string[] {
  // Only return the game installation paths, we get it directly internally
  const installs = getLutrisEpicInstallations();
  // Return relative dir names since getInstalledEpicGamePaths() expects basenames
  return installs.map((i) => path.basename(i.path));
}

export function getLutrisGogId(gamePath: string): string | null {
  const installs = getLutrisGOGInstallations();
  const found = installs.find((i) => path.resolve(i.path) === path.resolve(gamePath));
  return found ? found.slug : null;
}

export function getLutrisEpicAppName(gamePath: string): string | null {
  const installs = getLutrisEpicInstallations();
  const found = installs.find((i) => path.resolve(i.path) === path.resolve(gamePath));
  return found ? found.slug : null;
}

/**
 * Provide complete Lutris GOG Library
 */
export function getLutrisGogLibrary(): string[] {
  const titles = new Set<string>();
  const dbPath = getLutrisDBPath();
  if (!dbPath) return [];

  try {
    const db = new Database(dbPath, { readonly: true, fileMustExist: true });
    try {
      const dbGames = db.prepare(`SELECT name FROM games WHERE service='gog'`).all() as {
        name: string;
      }[];
      for (const game of dbGames) {
        if (game.name) {
          titles.add(getCleanTitle(game.name.trim()));
        }
      }
    } finally {
      db.close();
    }
  } catch (e) {
    console.error('[Lutris] Error reading GOG library:', e);
  }

  return Array.from(titles);
}

/**
 * Provide complete Lutris Epic Library
 */
export function getLutrisEpicLibrary(): string[] {
  const titles = new Set<string>();
  const dbPath = getLutrisDBPath();
  if (!dbPath) return [];

  try {
    const db = new Database(dbPath, { readonly: true, fileMustExist: true });
    try {
      // Use service_games to get a more unified library, or both
      const dbGames = db
        .prepare(`
                SELECT name FROM games WHERE service='egs'
                UNION 
                SELECT name FROM service_games WHERE service='egs'
            `)
        .all() as { name: string }[];

      for (const game of dbGames) {
        if (game.name) {
          titles.add(getCleanTitle(game.name.trim()));
        }
      }
    } finally {
      db.close();
    }
  } catch (e) {
    console.error('[Lutris] Error reading Epic library:', e);
  }

  return Array.from(titles);
}

/**
 * Full installed path maps for exact matching
 */
export function getLutrisInstalledEpicPathsFull(): {
  path: string;
  appName: string;
  slug: string;
}[] {
  return getLutrisEpicInstallations();
}
