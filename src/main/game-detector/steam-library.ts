import * as fs from 'fs';
import * as path from 'path';
import { parseAppManifest, parseLibraryFolders } from '../utils/vdf-parser';

/** Installed Steam games from one manifest scan, indexed two ways. */
export interface InstalledSteamGames {
  /** installdir (lowercase) -> full path */
  byFolder: Map<string, string>;
  /** app id -> full path (authoritative; immune to installdir/folder drift) */
  byAppId: Map<number, string>;
}

export function isValidSteamPath(steamPath: string): boolean {
  try {
    const requiredDirs = ['steamapps', 'appcache', 'config'];
    return requiredDirs.every((dir) => fs.existsSync(path.join(steamPath, dir)));
  } catch {
    return false;
  }
}

function realpathOr(dir: string): string {
  try {
    return fs.realpathSync(dir);
  } catch {
    return dir;
  }
}

/** The steamapps folders of one Steam install, its own first, with symlinked duplicates dropped. */
export function readSteamLibraryFolders(
  steamPath: string,
  // A Steam that writes its libraries in a form the host cannot open maps them here
  toHostPath: (libraryPath: string) => string | null = (libraryPath) => libraryPath
): string[] {
  const own = path.join(steamPath, 'steamapps');
  const folders = [own];
  const seen = new Set([realpathOr(own)]);
  try {
    const file = path.join(own, 'libraryfolders.vdf');
    if (!fs.existsSync(file)) {
      return folders;
    }
    for (const libraryPath of parseLibraryFolders(fs.readFileSync(file, 'utf8'))) {
      const hostPath = toHostPath(libraryPath.replace(/\\\\/g, '\\'));
      const steamapps = hostPath === null ? null : path.join(hostPath, 'steamapps');
      if (steamapps === null || !fs.existsSync(steamapps)) {
        continue;
      }
      const real = realpathOr(steamapps);
      if (!seen.has(real)) {
        seen.add(real);
        folders.push(steamapps);
      }
    }
  } catch (error) {
    console.error('[Steam] Error parsing library folders:', error);
  }
  return folders;
}

export function scanSteamGames(libraryFolders: string[]): InstalledSteamGames {
  const games = new Map<string, string>();
  const byAppId = new Map<number, string>();

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
              const appId = Number(manifest.appid);
              if (Number.isFinite(appId) && appId > 0) {
                byAppId.set(appId, gamePath);
              }
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

  return { byFolder: games, byAppId };
}

function mergeFirstWins<K>(maps: Map<K, string>[]): Map<K, string> {
  const merged = new Map<K, string>();
  for (const map of maps) {
    for (const [key, value] of map) {
      if (!merged.has(key)) {
        merged.set(key, value);
      }
    }
  }
  return merged;
}

/** The games of several Steam installs, the first install winning a game two have. */
export function mergeInstalledSteamGames(
  installs: InstalledSteamGames[]
): InstalledSteamGames {
  return {
    byFolder: mergeFirstWins(installs.map((games) => games.byFolder)),
    byAppId: mergeFirstWins(installs.map((games) => games.byAppId)),
  };
}

/**
 * Resolve a Steam game's install path directly from its appmanifest, keyed by
 * App ID. This is authoritative and order-independent: when several games share
 * a base installdir, Steam suffixes the second one's folder with the app id
 * (e.g. "WW1GameSeries 242860"), and only the manifest knows the real
 * installdir for each app.
 */
function resolveSteamGameByAppId(
  libraryFolders: string[],
  steamAppId: number
): string | null {
  for (const folder of libraryFolders) {
    const manifestPath = path.join(folder, `appmanifest_${steamAppId}.acf`);
    if (!fs.existsSync(manifestPath)) {
      continue;
    }

    try {
      const manifest = parseAppManifest(fs.readFileSync(manifestPath, 'utf8'));
      if (!manifest?.installdir) {
        continue;
      }

      const gamePath = path.join(folder, 'common', manifest.installdir);
      if (fs.existsSync(gamePath)) {
        return gamePath;
      }
    } catch {
      // Ignore and try the next library
    }
  }

  return null;
}

function normalizeSteamFolderName(gameFolderName: string | null): string | null {
  const normalized = gameFolderName
    ?.replace(/^steamapps[/\\]common[/\\]/i, '')
    .replace(/^common[/\\]/i, '');
  // Without a real name the folder fallbacks would match steamapps/common or steamapps itself.
  if (!normalized || normalized === '.' || normalized === '..') {
    return null;
  }
  return normalized;
}

/** One game in the libraries of one Steam install: by app id, then the manifest's installdir, then the folder. */
export function findSteamGameInLibraries(
  libraryFolders: string[],
  installed: () => InstalledSteamGames,
  gameFolderName: string | null,
  steamAppId?: number | null
): string | null {
  // The folder name in the database is ambiguous when several games share a base installdir, so the app id wins.
  if (steamAppId != null) {
    const pathByAppId = resolveSteamGameByAppId(libraryFolders, steamAppId);
    if (pathByAppId) {
      console.log(`[Steam] ✓ Game found via appid ${steamAppId}: ${pathByAppId}`);
      return pathByAppId;
    }
  }

  const folderName = normalizeSteamFolderName(gameFolderName);
  if (folderName === null) {
    return null;
  }

  const gamePathFromManifest = installed().byFolder.get(folderName.toLowerCase());
  if (
    gamePathFromManifest &&
    path.basename(gamePathFromManifest).toLowerCase() === folderName.toLowerCase() &&
    fs.existsSync(gamePathFromManifest)
  ) {
    console.log(`[Steam] ✓ Game found via appmanifest: ${gamePathFromManifest}`);
    return gamePathFromManifest;
  }

  for (const folder of libraryFolders) {
    const commonPath = path.join(folder, 'common', folderName);
    if (fs.existsSync(commonPath)) {
      console.log(`[Steam] ✓ Game found at (fallback): ${commonPath}`);
      return commonPath;
    }
  }

  return null;
}
