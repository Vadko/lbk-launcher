/**
 * Ubisoft Connect Launcher Utilities
 * Launch Ubisoft games via uplay:// protocol
 */

interface LaunchResult {
  success: boolean;
  error?: string;
}

/**
 * Launch a Ubisoft Connect game by its install id.
 * Uses the protocol: uplay://launch/{installId}/0
 *
 * The install id is the registry subkey name under Ubisoft\Launcher\Installs.
 *
 * @param installId - The Ubisoft install id for the game (e.g., "635")
 * @returns Promise with launch result
 */
export async function launchUplayGame(installId: string): Promise<LaunchResult> {
  try {
    console.log(`[Uplay] Launching game with install id: ${installId}`);

    const uplayUrl = `uplay://launch/${encodeURIComponent(installId)}/0`;

    console.log(`[Uplay] Using protocol URL: ${uplayUrl}`);

    const { shell } = await import('electron');
    await shell.openExternal(uplayUrl);

    return { success: true };
  } catch (error) {
    console.error('[Uplay] Failed to launch game:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to launch Uplay game',
    };
  }
}
