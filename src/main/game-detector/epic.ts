/**
 * Epic Games Detection
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { isLinux, isMacOS, isWindows } from '../utils/platform';

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
      const manifestPath = 'C:\\ProgramData\\Epic\\EpicGamesLauncher\\Data\\Manifests';
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
    const home = os.homedir();
    const heroicPaths = [
      path.join(home, 'Games/Heroic'),
      path.join(home, '.var/app/com.heroicgameslauncher.hgl/Games/Heroic'),
    ];

    // Check directories
    for (const heroicPath of heroicPaths) {
      if (fs.existsSync(heroicPath)) {
        const gamePath = path.join(heroicPath, gameFolderName);
        if (fs.existsSync(gamePath)) {
          console.log(`[Epic] ✓ Game found (Heroic): ${gamePath}`);
          return gamePath;
        }
      }
    }

    // Try parsing legendary_library.json
    try {
      const configPaths = [
        path.join(
          home,
          '.var/app/com.heroicgameslauncher.hgl/config/heroic/store_cache/legendary_library.json'
        ),
        path.join(home, '.config/heroic/store_cache/legendary_library.json'),
      ];

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
      const home = os.homedir();
      const heroicPaths = [
        path.join(home, 'Games/Heroic'),
        path.join(home, '.var/app/com.heroicgameslauncher.hgl/Games/Heroic'),
      ];

      for (const heroicPath of heroicPaths) {
        if (fs.existsSync(heroicPath)) {
          try {
            const epicGames = fs.readdirSync(heroicPath);
            for (const game of epicGames) {
              const gamePath = path.join(heroicPath, game);
              if (fs.statSync(gamePath).isDirectory()) {
                paths.push(game);
              }
            }
          } catch (e) {
            console.warn(`[Epic] Error reading Heroic path ${heroicPath}:`, e);
          }
        }
      }

      // Read from legendary_library.json as well
      try {
        const configPaths = [
          path.join(
            home,
            '.var/app/com.heroicgameslauncher.hgl/config/heroic/store_cache/legendary_library.json'
          ),
          path.join(home, '.config/heroic/store_cache/legendary_library.json'),
        ];

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
 * Get all Epic games from Heroic/Legendary library (owned games)
 * Returns array of game titles
 */
export function getHeroicEpicLibrary(): string[] {
  if (!isLinux()) return [];

  const home = os.homedir();
  const configPaths = [
    path.join(
      home,
      '.var/app/com.heroicgameslauncher.hgl/config/heroic/store_cache/legendary_library.json'
    ),
    path.join(home, '.config/heroic/store_cache/legendary_library.json'),
  ];

  const titles: string[] = [];

  try {
    for (const configPath of configPaths) {
      if (fs.existsSync(configPath)) {
        const content = fs.readFileSync(configPath, 'utf8');
        const data = JSON.parse(content);

        // Legendary library structure: { library: [...] }
        // Or sometimes just array? content seems to be { library: [...] }
        const games = Array.isArray(data) ? data : data.library || Object.values(data);

        for (const game of games as HeroicLegendaryGame[]) {
          // User reports Epic names are in description
          // Structure: extra.about.description
          if (game?.extra?.about?.description) {
            titles.push(game.extra.about.description);
          } else if (game.app_title && !game.app_title.match(/^[0-9a-f]{32}$/)) {
            // Fallback to app_title only if it doesn't look like a hash ID
            titles.push(game.app_title);
          } else if (game.title) {
            titles.push(game.title);
          }
        }
      }
    }
  } catch (error) {
    console.error('[Epic] Error reading Heroic/Legendary library:', error);
  }

  return titles;
}
