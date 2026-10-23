/**
 * Epic Games Detection
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { isLinux, isMacOS, isWindows } from '../utils/platform';
import { getEglInstallDirs } from './egl-linux';
import { parseEpicManifest } from './epic-manifest';
import { getCleanTitle } from './game-titles';
import { getHeroicGogInstallFolders } from './gog';
import {
  findGameInHeroicDirs,
  getAllHeroicGameFolders,
  getHeroicConfigPaths,
} from './heroic';
import { logIfChanged } from './log-if-changed';
import {
  getLutrisEpicGameDirNames,
  getLutrisEpicLibrary,
  getLutrisInstalledEpicPathsFull,
} from './lutris';

interface HeroicLegendaryGame {
  app_title?: string;
  title?: string;
  app_name?: string;
  appName?: string;
  install_path?: string;
  install?: {
    install_path?: string;
  };
  extra?: {
    about?: {
      description?: string;
    };
  };
  game?: {
    title?: string;
    app_name?: string;
    app_title?: string;
  };
  [key: string]: unknown;
}

/** Where the Epic Games Launcher keeps install manifests on this OS, whether or not it is installed */
export function getEpicManifestsCandidatePath(): string | null {
  if (isWindows()) {
    const programData = process.env.PROGRAMDATA;
    return programData
      ? path.join(programData, 'Epic', 'EpicGamesLauncher', 'Data', 'Manifests')
      : null;
  }
  if (isMacOS()) {
    return path.join(
      os.homedir(),
      'Library/Application Support/Epic/EpicGamesLauncher/Data/Manifests'
    );
  }
  return null;
}

/**
 * Detect Epic Games Launcher manifests path
 */
function getEpicPath(): string | null {
  try {
    const manifestPath = getEpicManifestsCandidatePath();
    if (manifestPath && fs.existsSync(manifestPath)) {
      logIfChanged('epic-path', `[Epic] Manifests found at: ${manifestPath}`);
      return manifestPath;
    }
  } catch (error) {
    console.error('[Epic] Error detecting path:', error);
  }

  logIfChanged('epic-path', '[Epic] Epic Games Launcher not found', 'warn');
  return null;
}

/**
 * Find Epic game by folder name
 */
export function findEpicGame(gameFolderName: string): string | null {
  console.log(`[Epic] Searching for game: "${gameFolderName}"`);

  if (isLinux()) {
    // Check Heroic directories, which also hold GOG installs
    const heroicPath = findGameInHeroicDirs(gameFolderName);
    if (heroicPath && !getHeroicGogInstallFolders().includes(path.basename(heroicPath))) {
      console.log(`[Epic] ✓ Game found (Heroic): ${heroicPath}`);
      return heroicPath;
    }

    // Try parsing legendary_library.json
    try {
      const configPaths = getHeroicConfigPaths().map((p) =>
        path.join(p, 'store_cache/legendary_library.json')
      );

      for (const configPath of configPaths) {
        if (fs.existsSync(configPath)) {
          const content = fs.readFileSync(configPath, 'utf8');
          const library = JSON.parse(content);
          // Handle both array and object format (values)
          const games = Array.isArray(library) ? library : Object.values(library);

          const game = games.find((g: HeroicLegendaryGame) => {
            if (g?.install?.install_path) {
              return (
                path.basename(g.install.install_path).toLowerCase() ===
                gameFolderName.toLowerCase()
              );
            }
            return false;
          });

          if (
            game &&
            game.install?.install_path &&
            fs.existsSync(game.install.install_path)
          ) {
            console.log(
              `[Epic] ✓ Game found via legendary_library.json: ${game.install.install_path}`
            );
            return game.install.install_path;
          }
        }
      }
    } catch (e) {
      console.warn('[Epic] Error checking Legendary config:', e);
    }

    const eglPath = getEglInstallDirs().find(
      (dir) => path.basename(dir).toLowerCase() === gameFolderName.toLowerCase()
    );
    if (eglPath) {
      console.log(`[Epic] ✓ Game found (Epic Games Launcher): ${eglPath}`);
      return eglPath;
    }

    // Check Lutris installations
    const normalize = (str: string) => str.toLowerCase().replace(/[^a-z0-9]/g, '');
    const targetFolder = normalize(gameFolderName);

    const lutrisPaths = getLutrisInstalledEpicPathsFull();
    for (const lutrisGame of lutrisPaths) {
      // Support exact or fuzzy matching on the end directory name
      const dirName = path.basename(lutrisGame.path);
      if (normalize(dirName) === targetFolder) {
        if (fs.existsSync(lutrisGame.path)) {
          console.log(`[Epic] ✓ Game found (Lutris): ${lutrisGame.path}`);
          return lutrisGame.path;
        }
      }
    }
  }

  const epicManifestPath = getEpicPath();
  if (!epicManifestPath) {
    logIfChanged(
      'epic-search',
      '[Epic] Cannot search - Epic Games Launcher not found',
      'warn'
    );
    return null;
  }

  try {
    const manifestFiles = fs
      .readdirSync(epicManifestPath)
      .filter((f: string) => f.endsWith('.item'));

    for (const manifestFile of manifestFiles) {
      const manifestFullPath = path.join(epicManifestPath, manifestFile);
      const manifest = parseEpicManifest(manifestFullPath);

      if (manifest) {
        const installDirName = path.basename(manifest.installLocation);

        if (installDirName.toLowerCase() === gameFolderName.toLowerCase()) {
          if (fs.existsSync(manifest.installLocation)) {
            console.log(
              `[Epic] ✓ Game found: ${manifest.displayName} at ${manifest.installLocation}`
            );
            return manifest.installLocation;
          }
        }
      }
    }

    console.warn(`[Epic] ✗ Game "${gameFolderName}" not found`);
  } catch (error) {
    console.error('[Epic] Error searching games:', error);
  }

  return null;
}

/**
 * Get all installed Epic game paths
 */
export function getInstalledEpicGamePaths(): string[] {
  const paths: string[] = [];

  try {
    if (isLinux()) {
      // GOG and Epic installs share Heroic's default dir; the GOG ones are known from its installed.json
      const gogFolders = new Set(getHeroicGogInstallFolders());
      paths.push(
        ...getAllHeroicGameFolders().filter((folder) => !gogFolders.has(folder))
      );

      // Read from legendary_library.json as well
      try {
        const configPaths = getHeroicConfigPaths().flatMap((p) => [
          path.join(p, 'store_cache/legendary_library.json'),
          path.join(p, 'store_cache/legendary_install_info.json'),
        ]);

        for (const configPath of configPaths) {
          if (fs.existsSync(configPath)) {
            const content = fs.readFileSync(configPath, 'utf8');
            const library = JSON.parse(content);
            const games = Array.isArray(library) ? library : Object.values(library);

            for (const game of games as HeroicLegendaryGame[]) {
              if (
                game?.install?.install_path &&
                fs.existsSync(game.install.install_path)
              ) {
                paths.push(path.basename(game.install.install_path));
              }
            }
          }
        }
      } catch (e) {
        console.warn('[Epic] Error reading Legendary config:', e);
      }

      // Get paths from Lutris
      paths.push(...getLutrisEpicGameDirNames());
      paths.push(...getEglInstallDirs().map((dir) => path.basename(dir)));
    }

    const epicManifestPath = getEpicPath();
    if (epicManifestPath && fs.existsSync(epicManifestPath)) {
      const manifestFiles = fs
        .readdirSync(epicManifestPath)
        .filter((f: string) => f.endsWith('.item'));

      for (const manifestFile of manifestFiles) {
        const manifestFullPath = path.join(epicManifestPath, manifestFile);
        const manifest = parseEpicManifest(manifestFullPath);

        if (manifest && fs.existsSync(manifest.installLocation)) {
          const installDirName = path.basename(manifest.installLocation);
          paths.push(installDirName);
        }
      }
    }
  } catch (error) {
    console.error('[Epic] Error getting game paths:', error);
  }

  if (paths.length > 0) {
    logIfChanged(
      'epic-installed',
      `[Epic] Found ${paths.length} installed games: ${paths.join(', ')}`
    );
  }

  return paths;
}

/**
 * Get all Epic games (installed/owned)
 * Returns array of game titles
 */
export function getEpicLibrary(): string[] {
  const titles = new Set<string>();

  // Helper to clean up titles (remove double spaces)
  const cleanTitle = (t: string) => t.replace(/\s+/g, ' ').trim();

  // Linux: Use Heroic/Legendary library
  if (isLinux()) {
    const configPaths = getHeroicConfigPaths().flatMap((p) => [
      path.join(p, 'store_cache/legendary_library.json'),
      path.join(p, 'store_cache/legendary_install_info.json'),
    ]);

    try {
      for (const configPath of configPaths) {
        if (fs.existsSync(configPath)) {
          const content = fs.readFileSync(configPath, 'utf8');
          const data = JSON.parse(content);

          // Legendary library structure: { library: [...] }
          const games = Array.isArray(data) ? data : data.library || Object.values(data);

          for (const item of games as HeroicLegendaryGame[]) {
            const game = item.game || item; // Handle install_info structure

            // User reports Epic names are in description
            if (game.app_title && !game.app_title.match(/^[0-9a-f]{32}$/)) {
              titles.add(getCleanTitle(cleanTitle(game.app_title)));
            } else if (game.title) {
              titles.add(getCleanTitle(cleanTitle(game.title)));
            } else if (item.extra?.about?.description) {
              titles.add(getCleanTitle(cleanTitle(item.extra.about.description)));
            }
          }
        }
      }
    } catch (error) {
      console.error('[Epic] Error reading Heroic/Legendary library:', error);
    }

    // Add games from Lutris EGS library
    const lutrisTitles = getLutrisEpicLibrary();
    for (const title of lutrisTitles) {
      titles.add(title);
    }
  }

  // Windows/macOS: Use native Epic Games Launcher manifests
  if (isWindows() || isMacOS()) {
    const epicManifestPath = getEpicPath();

    if (epicManifestPath && fs.existsSync(epicManifestPath)) {
      try {
        const manifestFiles = fs
          .readdirSync(epicManifestPath)
          .filter((f: string) => f.endsWith('.item'));

        for (const manifestFile of manifestFiles) {
          const manifestFullPath = path.join(epicManifestPath, manifestFile);
          const manifest = parseEpicManifest(manifestFullPath);

          if (manifest?.displayName) {
            titles.add(getCleanTitle(manifest.displayName));
          }
        }
      } catch (error) {
        console.error('[Epic] Error reading manifests:', error);
      }
    }
  }

  const result = Array.from(titles);
  if (result.length > 0) {
    // Print only first 15 detected titles to keep logs readable.
    const maxLoggedGames = 15;
    const visibleTitles = result.slice(0, maxLoggedGames).join(', ');
    logIfChanged(
      'epic-library',
      `[Epic] Found ${result.length} games in library: ${visibleTitles}`
    );
  }

  return result;
}

/**
 * Get Epic App Name from Heroic/Legendary config by path
 */
export function getHeroicEpicAppName(gamePath: string): string | null {
  if (!isLinux()) {
    return null;
  }

  try {
    const configPaths = getHeroicConfigPaths().flatMap((p) => [
      path.join(p, 'store_cache/legendary_library.json'),
      path.join(p, 'store_cache/legendary_install_info.json'),
    ]);

    for (const configPath of configPaths) {
      if (fs.existsSync(configPath)) {
        const content = fs.readFileSync(configPath, 'utf8');
        let data;
        try {
          data = JSON.parse(content);
        } catch {
          continue;
        }

        let games: HeroicLegendaryGame[] = [];
        let gamesById: Record<string, HeroicLegendaryGame> = {};

        if (Array.isArray(data)) {
          games = data;
        } else if (data.library && Array.isArray(data.library)) {
          games = data.library;
        } else {
          // Fallback for object format (keys are app_names) where values are games
          gamesById = data;
          games = Object.values(data);
        }

        // 1. Try exact path match
        const game = games.find((g: HeroicLegendaryGame) => {
          const installPath = g?.install?.install_path || g?.install_path;
          return installPath && path.resolve(installPath) === path.resolve(gamePath);
        });

        if (game) {
          if (game.app_name) {
            return game.app_name;
          }
          if (game.appName) {
            return game.appName;
          }
        }

        // 1.5 Try path match in Object keys loop (if gamesById was populated)
        for (const [appName, g] of Object.entries(gamesById)) {
          const installPath = g?.install?.install_path || g?.install_path;
          if (installPath && path.resolve(installPath) === path.resolve(gamePath)) {
            return appName;
          }
        }
      }
    }
  } catch (error) {
    console.error('[Epic] Error getting Heroic AppName:', error);
  }

  return null;
}

function findEpicManifest(gamePath: string): ReturnType<typeof parseEpicManifest> {
  const epicManifestPath = getEpicPath();
  if (!epicManifestPath || !fs.existsSync(epicManifestPath)) {
    return null;
  }
  try {
    const resolvedGamePath = path.resolve(gamePath);
    const matches = fs
      .readdirSync(epicManifestPath)
      .filter((f: string) => f.endsWith('.item'))
      .map((f) => parseEpicManifest(path.join(epicManifestPath, f)))
      .filter(
        (manifest) =>
          manifest?.installLocation &&
          path.resolve(manifest.installLocation) === resolvedGamePath
      );
    // DLC manifests share the game's folder
    return (
      matches.find((m) => !m?.mainGameAppName || m.mainGameAppName === m.appName) ??
      matches[0] ??
      null
    );
  } catch (error) {
    console.error('[Epic] Error reading Epic manifests:', error);
    return null;
  }
}

// The id the epic:// protocol takes for a game folder
export function getEpicAppName(gamePath: string): string | null {
  // For Linux, use Heroic config
  if (isLinux()) {
    return getHeroicEpicAppName(gamePath);
  }
  const manifest = findEpicManifest(gamePath);
  // Prefer AppName: it is the ownership key Epic checks on launch.
  return manifest?.appName || manifest?.catalogItemId || null;
}

// EGL's own app id, the key of its per-game settings on Windows
export function getEpicManifestAppId(gamePath: string): string | null {
  const manifest = findEpicManifest(gamePath);
  return manifest?.catalogNamespace && manifest.catalogItemId && manifest.appName
    ? `${manifest.catalogNamespace}:${manifest.catalogItemId}:${manifest.appName}`
    : null;
}
