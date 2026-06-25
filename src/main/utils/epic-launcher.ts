/**
 * Epic Games Launcher Utilities
 * Launch Epic Games via com.epicgames.launcher:// protocol
 */

interface LaunchResult {
  success: boolean;
  error?: string;
}

/**
 * Launch an Epic game by its AppName.
 * Uses the Epic Games Launcher protocol: com.epicgames.launcher://apps/{appName}?action=launch&silent=true
 *
 * The AppName must be the one from the user's own manifest — it is the ownership
 * key Epic validates.
 *
 * @param appName - The Epic AppName for the game (e.g., "Daisy")
 * @returns Promise with launch result
 */
export async function launchEpicGame(appName: string): Promise<LaunchResult> {
  try {
    console.log(`[Epic] Launching game with AppName: ${appName}`);

    // URL-encode to handle any special characters in the AppName
    const encodedAppName = encodeURIComponent(appName);
    const epicUrl = `com.epicgames.launcher://apps/${encodedAppName}?action=launch&silent=true`;

    console.log(`[Epic] Using protocol URL: ${epicUrl}`);

    // Use Electron's shell.openExternal to open the protocol URL
    const { shell } = await import('electron');
    await shell.openExternal(epicUrl);

    return { success: true };
  } catch (error) {
    console.error('[Epic] Failed to launch game:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to launch Epic game',
    };
  }
}
