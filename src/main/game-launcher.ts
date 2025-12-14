import * as fs from 'fs';
import * as path from 'path';
import { spawn, exec } from 'child_process';
import { promisify } from 'util';
import { isWindows, isMacOS } from './utils/platform';

const execAsync = promisify(exec);

/**
 * Find Steam App ID from game folder by looking at appmanifest files
 */
export async function findSteamAppId(gamePath: string): Promise<string | null> {
  try {
    console.log('[GameLauncher] Finding Steam App ID for path:', gamePath);

    // Navigate up to find steamapps folder
    let currentPath = gamePath;
    let steamappsPath: string | null = null;

    // Go up max 5 levels to find steamapps
    for (let i = 0; i < 5; i++) {
      const parentPath = path.dirname(currentPath);
      if (parentPath === currentPath) break; // reached root

      const steamappsCandidate = path.join(parentPath, 'steamapps');
      if (fs.existsSync(steamappsCandidate)) {
        steamappsPath = steamappsCandidate;
        break;
      }

      currentPath = parentPath;
    }

    if (!steamappsPath) {
      console.warn('[GameLauncher] Could not find steamapps folder');
      return null;
    }

    // Get the game folder name
    const gameFolderName = path.basename(gamePath);
    console.log('[GameLauncher] Looking for game folder:', gameFolderName);

    // Look for appmanifest files in steamapps
    const files = fs.readdirSync(steamappsPath);
    const manifestFiles = files.filter(
      (f) => f.startsWith('appmanifest_') && f.endsWith('.acf')
    );

    for (const manifestFile of manifestFiles) {
      const manifestPath = path.join(steamappsPath, manifestFile);
      const content = fs.readFileSync(manifestPath, 'utf8');

      // Parse VDF to find installdir
      const { parseAppManifest } = await import('./utils/vdf-parser');
      const manifest = parseAppManifest(content);

      if (
        manifest &&
        manifest.installdir.toLowerCase() === gameFolderName.toLowerCase()
      ) {
        // Extract app ID from filename (appmanifest_APPID.acf)
        const appId = manifestFile.replace('appmanifest_', '').replace('.acf', '');
        console.log(
          `[GameLauncher] ✓ Found Steam App ID: ${appId} for ${gameFolderName} (manifest: ${manifest.name})`
        );
        return appId;
      }
    }

    console.warn(
      '[GameLauncher] ✗ Could not find Steam App ID for game folder:',
      gameFolderName
    );
    return null;
  } catch (error) {
    console.error('[GameLauncher] Error finding Steam App ID:', error);
    return null;
  }
}

/**
 * Find and launch the main executable in the game folder
 */
export async function launchGameExecutable(gamePath: string): Promise<void> {
  try {
    console.log('[GameLauncher] Looking for executable in:', gamePath);

    // Common executable patterns for Windows
    const windowsExecutablePatterns = [
      /\.exe$/i, // Windows executables
    ];

    // macOS app bundles
    const macAppPattern = /\.app$/i;

    // Find all potential executables
    const files = fs.readdirSync(gamePath);
    const executables: string[] = [];

    for (const file of files) {
      const filePath = path.join(gamePath, file);
      const stats = fs.statSync(filePath);

      if (stats.isFile()) {
        // Windows: check by extension
        if (isWindows()) {
          for (const pattern of windowsExecutablePatterns) {
            if (pattern.test(file)) {
              executables.push(filePath);
              break;
            }
          }
        }
        // macOS/Linux: check executable permission or .app bundle
        else {
          // Check for .app bundles on macOS
          if (isMacOS() && macAppPattern.test(file)) {
            executables.push(filePath);
          }
          // Check for executable permission on Unix-like systems
          else {
            try {
              fs.accessSync(filePath, fs.constants.X_OK);
              // Skip common non-executable file types
              const skipExtensions = [
                '.txt',
                '.md',
                '.json',
                '.xml',
                '.cfg',
                '.ini',
                '.log',
                '.png',
                '.jpg',
                '.ico',
                '.dll',
                '.so',
                '.dylib',
              ];
              const ext = path.extname(file).toLowerCase();
              if (!skipExtensions.includes(ext)) {
                executables.push(filePath);
              }
            } catch {
              // Not executable, skip
            }
          }
        }
      }
      // Also check directories for .app bundles on macOS
      else if (stats.isDirectory() && isMacOS() && macAppPattern.test(file)) {
        executables.push(filePath);
      }
    }

    if (executables.length === 0) {
      throw new Error('Не вдалося знайти виконуваний файл гри');
    }

    // Prefer executables with certain names
    const preferredNames = ['game', 'launcher', 'start', 'play'];
    let selectedExecutable = executables[0];

    for (const exe of executables) {
      const baseName = path.basename(exe, path.extname(exe)).toLowerCase();
      if (preferredNames.some((name) => baseName.includes(name))) {
        selectedExecutable = exe;
        break;
      }
    }

    console.log('[GameLauncher] Launching executable:', selectedExecutable);

    // Launch the game
    if (isWindows()) {
      // On Windows, use spawn with detached option
      spawn(selectedExecutable, [], {
        detached: true,
        stdio: 'ignore',
        cwd: path.dirname(selectedExecutable),
      }).unref();
    } else if (isMacOS()) {
      // On macOS, use 'open' command
      if (selectedExecutable.endsWith('.app')) {
        await execAsync(`open "${selectedExecutable}"`);
      } else {
        spawn(selectedExecutable, [], {
          detached: true,
          stdio: 'ignore',
          cwd: path.dirname(selectedExecutable),
        }).unref();
      }
    } else {
      // On Linux - try multiple methods
      const cwd = path.dirname(selectedExecutable);

      // First, try to run with shell (handles scripts and binaries)
      try {
        spawn(selectedExecutable, [], {
          detached: true,
          stdio: 'ignore',
          cwd,
          shell: true,
        }).unref();
      } catch (shellError) {
        console.warn(
          '[GameLauncher] Shell spawn failed, trying direct spawn:',
          shellError
        );
        // Fallback to direct spawn
        spawn(selectedExecutable, [], {
          detached: true,
          stdio: 'ignore',
          cwd,
        }).unref();
      }
    }

    console.log('[GameLauncher] Game launched successfully');
  } catch (error) {
    console.error('[GameLauncher] Error launching game:', error);
    throw error;
  }
}
