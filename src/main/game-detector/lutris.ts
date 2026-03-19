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

/**
 * Lutris Database Manager - cached database connection management
 */
class LutrisDBManager {
  private static instance: LutrisDBManager | null = null;
  private db: Database.Database | null = null;
  private dbPath: string | null = null;
  private lastChecked = 0;
  private readonly CHECK_INTERVAL = 60000; // 1 minute

  private constructor() {
    // Singleton pattern implementation
  }

  static getInstance(): LutrisDBManager {
    if (!this.instance) {
      this.instance = new LutrisDBManager();
    }
    return this.instance;
  }

  /**
   * Get active database connection or create new one
   */
  private getConnection(): Database.Database | null {
    const now = Date.now();
    
    // Check if we need to update database path
    if (!this.dbPath || now - this.lastChecked > this.CHECK_INTERVAL) {
      const newDbPath = getLutrisDBPath();
      
      // Close old connection if path changed
      if (this.db && this.dbPath && newDbPath !== this.dbPath) {
        this.close();
      }
      
      this.dbPath = newDbPath;
      this.lastChecked = now;
    }

    if (!this.dbPath) return null;

    // Create new connection if needed
    if (!this.db) {
      try {
        this.db = new Database(this.dbPath, { readonly: true, fileMustExist: true });
      } catch (error) {
        console.error('[Lutris] Error opening database:', error);
        return null;
      }
    }

    return this.db;
  }

  /**
   * Execute database query
   */
  query<T = Record<string, unknown>>(sql: string): T[] {
    const db = this.getConnection();
    if (!db) return [];

    try {
      return db.prepare(sql).all() as T[];
    } catch (error) {
      console.error(`[Lutris] Database query failed: ${sql}`, error);
      return [];
    }
  }

  /**
   * Close database connection
   */
  close(): void {
    if (this.db) {
      try {
        this.db.close();
      } catch (error) {
        console.warn('[Lutris] Error closing database:', error);
      }
      this.db = null;
    }
  }

  /**
   * Validate JSON and safely parse it
   */
  static parseJSON(jsonString: string): Record<string, unknown> | null {
    try {
      const parsed = JSON.parse(jsonString);
      return parsed && typeof parsed === 'object' ? parsed : null;
    } catch {
      return null;
    }
  }
}

// Global database manager instance
const dbManager = LutrisDBManager.getInstance();

// Close database on process termination
process.on('exit', () => dbManager.close());
process.on('SIGINT', () => dbManager.close());
process.on('SIGTERM', () => dbManager.close());

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

/**
 * Type guard to check if parsed JSON matches Epic game details structure
 */
function isEpicGameDetails(obj: Record<string, unknown> | null): obj is EpicGameDetails {
  return obj !== null && typeof obj === 'object';
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

  // Get all GOG games using the cached DB connection
  const dbGames = dbManager.query<LutrisGame>(
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

  // Get all Epic games with their details using cached DB connection
  const dbGames = dbManager.query<LutrisGame>(`
    SELECT g.name, g.directory, g.service_id, g.slug, sg.details 
    FROM games g 
    LEFT JOIN service_games sg ON g.service_id = sg.appid 
    WHERE g.service='egs'
  `);

  for (const game of dbGames) {
    if (game.directory && game.details) {
      const parsedDetails = LutrisDBManager.parseJSON(game.details);
      if (!isEpicGameDetails(parsedDetails)) {
        console.warn(`[Lutris] Invalid JSON in details for ${game.name}`);
        continue;
      }

      const details = parsedDetails as EpicGameDetails;
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

  // Get directories using cached DB connection
  const dbGames = dbManager.query<{ directory: string }>(
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

  // Get GOG library using cached DB connection
  const dbGames = dbManager.query<{ name: string }>(
    `SELECT name FROM games WHERE service='gog'`
  );
  
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
  const dbGames = dbManager.query<{ name: string }>(`
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
