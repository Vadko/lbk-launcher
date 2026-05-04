/**
 * Epic Games Launcher Utilities
 * Launch Epic Games via com.epicgames.launcher:// protocol
 */

interface LaunchResult {
  success: boolean;
  error?: string;
}

/**
 * Launch an Epic game by its app identifier (CatalogItemId or AppName)
 * Uses the Epic Games Launcher protocol: com.epicgames.launcher://apps/{appId}?action=launch&silent=true
 *
 * @param appId - The app identifier (e.g., "daisy:df656ca933ea44a2a68d10d9dd4b6c31:Daisy" or simple app name)
 * @returns Promise with launch result
 */
export async function launchEpicGame(appId: string): Promise<LaunchResult> {
  try {
    console.log(`[Epic] Launching game with App ID: ${appId}`);

    // URL-encode the app ID to handle special characters like colons
    const encodedAppId = encodeURIComponent(appId);
    const epicUrl = `com.epicgames.launcher://apps/daisy%3A${encodedAppId}%3ADaisy?action=launch&silent=true`;

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
