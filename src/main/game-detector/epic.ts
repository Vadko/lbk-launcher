/**
 * Epic Games Detection
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { isLinux, isMacOS, isWindows } from '../utils/platform';
import {
  findGameInHeroicDirs,
  getAllHeroicGameFolders,
  getHeroicConfigPaths,
} from './heroic';

interface HeroicLegendaryGame {
  app_title: string;
  title: string;
  install?: {
    install_path: string;
  };
  extra?: {
    about?: {
      description?: string;
    };
  };
  [key: string]: unknown;
}

/**
 * Detect Epic Games Launcher manifests path
 */
function getEpicPath(): string | null {
  try {
    if (isWindows()) {
      const programData = process.env.PROGRAMDATA;
      if (!programData) return null;
      const manifestPath = path.join(programData, 'Epic', 'EpicGamesLauncher', 'Data', 'Manifests');
      if (fs.existsSync(manifestPath)) {
        console.log('[Epic] Manifests found at:', manifestPath);
        return manifestPath;
      }
    } else if (isMacOS()) {
      const manifestPath = path.join(
        os.homedir(),
        'Library/Application Support/Epic/EpicGamesLauncher/Data/Manifests'
      );
      if (fs.existsSync(manifestPath)) {
        console.log('[Epic] Manifests found at:', manifestPath);
        return manifestPath;
      }
    }
  } catch (error) {
    console.error('[Epic] Error detecting path:', error);
  }

  console.warn('[Epic] Epic Games Launcher not found');
  return null;
}

/**
 * Parse Epic Games manifest file
 */
function parseEpicManifest(
  manifestPath: string
): { installLocation: string; displayName: string } | null {
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
    console.error(`[Epic] Error parsing manifest ${manifestPath}:`, error);
  }
  return null;
}

/**
 * Find Epic game by folder name
 */
export function findEpicGame(gameFolderName: string): string | null {
  console.log(`[Epic] Searching for game: "${gameFolderName}"`);

  if (isLinux()) {
    // Check Heroic directories
    const heroicPath = findGameInHeroicDirs(gameFolderName);
    if (heroicPath) {
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
  }

  const epicManifestPath = getEpicPath();
  if (!epicManifestPath) {
    console.warn('[Epic] Cannot search - Epic Games Launcher not found');
    return null;
  }

  try {
    const manifestFiles = fs
      .readdirSync(epicManifestPath)
      .filter((f) => f.endsWith('.item'));

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
      // Get all game folders from Heroic directories
      paths.push(...getAllHeroicGameFolders());

      // Read from legendary_library.json as well
      try {
        const configPaths = getHeroicConfigPaths().flatMap((p) => [
          path.join(p, 'store_cache/legendary_library.json'),
          path.join(p, 'store_cache/legendary_install_info.json')
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
    }

    const epicManifestPath = getEpicPath();
    if (epicManifestPath && fs.existsSync(epicManifestPath)) {
      const manifestFiles = fs
        .readdirSync(epicManifestPath)
        .filter((f) => f.endsWith('.item'));

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
      path.join(p, 'store_cache/legendary_install_info.json')
    ]);

    try {
      for (const configPath of configPaths) {
        if (fs.existsSync(configPath)) {
          const content = fs.readFileSync(configPath, 'utf8');
          const data = JSON.parse(content);

          // Legendary library structure: { library: [...] }
          const games = Array.isArray(data) ? data : data.library || Object.values(data);

          for (const item of games as any[]) {
            const game = item.game || item; // Handle install_info structure

            // User reports Epic names are in description
            if (game?.extra?.about?.description) {
              titles.add(cleanTitle(game.extra.about.description));
            } else if (game.app_title && !game.app_title.match(/^[0-9a-f]{32}$/)) {
              titles.add(cleanTitle(game.app_title));
            } else if (game.title) {
              titles.add(cleanTitle(game.title));
            }
          }
        }
      }
    } catch (error) {
      console.error('[Epic] Error reading Heroic/Legendary library:', error);
    }
  }

  // Windows/macOS: Use native Epic Games Launcher manifests
  if (isWindows() || isMacOS()) {
    const epicManifestPath = getEpicPath();

    if (epicManifestPath && fs.existsSync(epicManifestPath)) {
      try {
        const manifestFiles = fs
          .readdirSync(epicManifestPath)
          .filter((f) => f.endsWith('.item'));

        for (const manifestFile of manifestFiles) {
          const manifestFullPath = path.join(epicManifestPath, manifestFile);
          const manifest = parseEpicManifest(manifestFullPath);

          if (manifest?.displayName) {
            titles.add(manifest.displayName);
          }
        }
      } catch (error) {
        console.error('[Epic] Error reading manifests:', error);
      }
    }
  }

  const result = Array.from(titles);
  if (result.length > 0) {
    console.log(`[Epic] Found ${result.length} games in library`);
  }

  return result;
}

/**
 * Get Epic App Name from Heroic/Legendary config by path
 */
export function getHeroicEpicAppName(gamePath: string): string | null {
  if (!isLinux()) return null;

  try {
    const configPaths = getHeroicConfigPaths().flatMap((p) => [
      path.join(p, 'store_cache/legendary_library.json'),
      path.join(p, 'store_cache/legendary_install_info.json')
    ]);

    // Helper to normalize strings for comparison (remove special chars, lowercase)
    const normalize = (str: string) => str.toLowerCase().replace(/[^a-z0-9]/g, '');
    const targetFolder = normalize(path.basename(gamePath));

    for (const configPath of configPaths) {
      if (fs.existsSync(configPath)) {
        const content = fs.readFileSync(configPath, 'utf8');
        let data;
        try {
          data = JSON.parse(content);
        } catch (e) { continue; }

        let games: any[] = [];
        let gamesById: Record<string, any> = {};

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
        const game = games.find((g: any) => {
          const installPath = g?.install?.install_path || g?.install_path;
          return installPath && path.resolve(installPath) === path.resolve(gamePath);
        });

        if (game) {
          if (game.app_name) return game.app_name;
          if (game.appName) return game.appName;
        }

        // 1.5 Try path match in Object keys loop (if gamesById was populated)
        for (const [appName, g] of Object.entries(gamesById)) {
          const val = g as any;
          const installPath = val?.install?.install_path || val?.install_path;
          if (installPath && path.resolve(installPath) === path.resolve(gamePath)) {
            return appName;
          }
        }

        // 2. Fallback: Title match (Folder name matching Game Title)
        const gameByTitle = games.find((g: any) => {
          const title = g?.title || g?.game?.title; // game.title for install_info
          return title && normalize(title) === targetFolder;
        });

        if (gameByTitle) {
          if (gameByTitle.app_name) return gameByTitle.app_name;
          if (gameByTitle.appName) return gameByTitle.appName;
          if (gameByTitle.game?.app_name) return gameByTitle.game.app_name;
        }

        // Check object items by Title
        for (const [appName, g] of Object.entries(gamesById)) {
          const val = g as any;
          const title = val?.title || val?.game?.title;
          if (title && normalize(title) === targetFolder) {
            return appName;
          }
          // Also check if appName itself is the key (already handled by iteration logic if needed?)
          // Usually gamesById has appName as key.
          if (Object.keys(gamesById).includes(appName)) {
            // Double check if this entry is the one we want via Title
          }
        }
      }
    }
  } catch (error) {
    console.error('[Epic] Error getting Heroic AppName:', error);
  }

  return null;
}
