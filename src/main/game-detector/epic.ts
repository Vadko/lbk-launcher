/**
 * Epic Games Detection
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { isMacOS, isWindows } from '../utils/platform';

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
