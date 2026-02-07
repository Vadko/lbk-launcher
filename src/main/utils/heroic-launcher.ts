import { spawn } from 'child_process';
import * as fs from 'fs';
import { isLinux } from './platform';

interface HeroicLaunchResult {
  success: boolean;
  error?: string;
}

/**
 * Check if running inside Flatpak
 */
function isRunningInFlatpak(): boolean {
  return !!process.env.FLATPAK_ID;
}

/**
 * Launch a game via Heroic Games Launcher
 * @param appName Service-specific game ID (app_name for Legendary, gameId for GOG)
 * @param runner 'legendary' for Epic, 'gog' for GOG, 'sideload' for other
 */
export async function launchHeroicGame(
  appName: string,
  runner: 'legendary' | 'gog' | 'sideload' = 'legendary'
): Promise<HeroicLaunchResult> {
  if (!isLinux()) {
    return { success: false, error: 'Heroic launching is only supported on Linux' };
  }

  console.log(`[HeroicLauncher] Launching ${appName} (runner: ${runner})...`);

  // Construct the heroic:// URI
  // Schema: heroic://launch?appName=<appName>&runner=<runner>
  const heroicUri = `heroic://launch?appName=${appName}&runner=${runner}`;

  try {
    // 1. Check for Flatpak Heroic (most common on Steam Deck / modern Linux desktops)
    // We can try to launch it via flatpak run from host or from within flatpak

    // If we are IN a flatpak (LittleBit is flatpak'd), we need to use flatpak-spawn --host
    if (isRunningInFlatpak()) {
      // We assume the user has com.heroicgameslauncher.hgl installed
      // Command: flatpak-spawn --host flatpak run com.heroicgameslauncher.hgl --no-gui --no-sandbox "URI"

      console.log(
        '[HeroicLauncher] Launching via flatpak-spawn (Flatpak -> Host Flatpak)...'
      );

      const child = spawn(
        'flatpak-spawn',
        [
          '--host',
          'flatpak',
          'run',
          'com.heroicgameslauncher.hgl',
          '--no-gui',
          '--no-sandbox',
          heroicUri,
        ],
        {
          detached: true,
          stdio: 'ignore',
        }
      );
      child.unref();
      return { success: true };
    }

    // If we are NOT in flatpak (Native LittleBit)

    // Check if flatpak is installed and Heroic is installed as flatpak
    let isHeroicFlatpak = false;
    try {
      // Simple check if directory exists (fast check)
      // or check `flatpak list` (slower)
      // Let's guess based on common path
      if (
        fs.existsSync('/var/lib/flatpak/app/com.heroicgameslauncher.hgl') ||
        fs.existsSync(
          `${process.env.HOME}/.local/share/flatpak/app/com.heroicgameslauncher.hgl`
        )
      ) {
        isHeroicFlatpak = true;
      }
    } catch (e) {
      /* ignore */
    }

    if (isHeroicFlatpak) {
      console.log(
        '[HeroicLauncher] Launching via flatpak run (Native -> Host Flatpak)...'
      );
      const child = spawn(
        'flatpak',
        ['run', 'com.heroicgameslauncher.hgl', '--no-gui', '--no-sandbox', heroicUri],
        {
          detached: true,
          stdio: 'ignore',
        }
      );
      child.unref();
      return { success: true };
    }

    // 2. Fallback to Native Heroic command
    console.log('[HeroicLauncher] Launching via native command...');
    const child = spawn('heroic', ['--no-gui', '--no-sandbox', heroicUri], {
      detached: true,
      stdio: 'ignore',
    });

    child.on('error', (err) => {
      console.error('[HeroicLauncher] Failed to launch native heroic:', err);
    });

    child.unref();
    return { success: true };
  } catch (error) {
    console.error('[HeroicLauncher] Error launching game:', error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : 'Unknown error launching Heroic game',
    };
  }
}
