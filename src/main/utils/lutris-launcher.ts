import { type ChildProcess, exec, spawn } from 'child_process';
import { promisify } from 'util';
import { isLinux } from './platform';

const execAsync = promisify(exec);

const FLATPAK_LUTRIS_ID = 'net.lutris.Lutris';

/**
 * Check if a Flatpak wrapper exists safely
 */
async function isFlatpakLutrisInstalled(): Promise<boolean> {
  try {
    const { stdout } = await execAsync(
      `flatpak-spawn --host flatpak info ${FLATPAK_LUTRIS_ID}`
    );
    return stdout.includes(FLATPAK_LUTRIS_ID);
  } catch (error) {
    // Expected to throw if Flatpak wrapper isn't installed
    return false;
  }
}

/**
 * Spawn a process on the host system when running inside Flatpak
 */
function spawnOnHost(command: string, args: string[] = []): ChildProcess {
  console.log(`[LutrisLauncher] Spawning on host: ${command} ${args.join(' ')}`);
  const child = spawn('flatpak-spawn', ['--host', command, ...args], {
    detached: true,
    stdio: 'ignore',
  });

  child.on('error', (err) => {
    console.error(`[LutrisLauncher] Error spawning ${command} on host:`, err);
  });

  // Unref to let the parent process exit while this child keeps running
  child.unref();
  return child;
}

/**
 * Launch a Lutris game by its slug
 */
export async function launchLutrisGame(
  gameSlug: string
): Promise<{ success: boolean; error?: string }> {
  if (!isLinux()) {
    return { success: false, error: 'Lutris is only supported on Linux' };
  }

  try {
    const isFlatpakMode = process.env.FLATPAK_ID !== undefined;
    const lutrisUri = `lutris:rungame/${gameSlug}`;

    if (isFlatpakMode) {
      console.log(
        `[LutrisLauncher] Launching via flatpak-spawn (Flatpak -> Host Flatpak) ${lutrisUri}...`
      );

      const hasFlatpakLutris = await isFlatpakLutrisInstalled();

      if (hasFlatpakLutris) {
        spawnOnHost('flatpak', ['run', FLATPAK_LUTRIS_ID, lutrisUri]);
      } else {
        spawnOnHost('lutris', [lutrisUri]);
      }
    } else {
      console.log(`[LutrisLauncher] Launching directly via native lutris: ${lutrisUri}`);

      // Try launching natively via xdg-open if the custom URI schema is registered, or pass specifically CLI
      const child = spawn('lutris', [lutrisUri], {
        detached: true,
        stdio: 'ignore',
      });
      child.unref();

      // Simple fallback if 'lutris' binary isn't perfectly configured in $PATH but flatpak is available
      child.on('error', (err) => {
        console.warn(
          '[LutrisLauncher] Native spawn failed, trying fallback xdg-open/flatpak',
          err
        );
        const fallbackChild = spawn('xdg-open', [lutrisUri], {
          detached: true,
          stdio: 'ignore',
        });
        fallbackChild.on('error', (fallbackErr) => {
          console.error('[LutrisLauncher] Fallback xdg-open spawn failed:', fallbackErr);
        });
        fallbackChild.unref();
      });
    }

    return { success: true };
  } catch (error) {
    console.error('[LutrisLauncher] Error launching game:', error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : 'Не вдалося запустити гру через Lutris',
    };
  }
}
