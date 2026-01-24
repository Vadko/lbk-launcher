/**
 * VDF (Valve Data Format) Parser
 * Using @node-steam/vdf library
 */

import * as vdf from '@node-steam/vdf';

/**
 * Parse Steam libraryfolders.vdf file
 */
export function parseLibraryFolders(content: string): string[] {
  const parsed = vdf.parse(content);
  const libraries: string[] = [];

  // The VDF structure is: "libraryfolders" -> { "0": {...}, "1": {...}, ... }
  const libraryFolders = parsed?.libraryfolders;
  if (!libraryFolders || typeof libraryFolders === 'string') return libraries;

  // Iterate through numbered entries
  for (const key in libraryFolders) {
    const entry = libraryFolders[key];
    if (
      entry &&
      typeof entry === 'object' &&
      'path' in entry &&
      typeof entry.path === 'string'
    ) {
      libraries.push(entry.path);
    }
  }

  return libraries;
}

/**
 * Parse Steam localconfig.vdf file and extract all App IDs from user's library
 * Path: userdata/<steamid>/config/localconfig.vdf
 * Structure: UserLocalConfigStore.Software.Valve.Steam.apps.<appid>
 * Returns all App IDs that user has ever launched (their full library)
 */
export function parseLocalConfigApps(content: string): number[] {
  try {
    const parsed = vdf.parse(content);
    const appIds: number[] = [];

    // Navigate to: UserLocalConfigStore.Software.Valve.Steam.apps
    const apps = parsed?.UserLocalConfigStore?.Software?.Valve?.Steam?.apps;
    if (!apps || typeof apps !== 'object') return [];

    for (const appId of Object.keys(apps)) {
      const parsedAppId = parseInt(appId, 10);
      // Filter out system entries (0, 1, 2, 7) and invalid IDs
      if (!isNaN(parsedAppId) && parsedAppId > 10) {
        appIds.push(parsedAppId);
      }
    }

    return appIds;
  } catch (error) {
    console.error('[VDFParser] Error parsing localconfig.vdf:', error);
    return [];
  }
}

/**
 * Parse Steam appmanifest file
 */
interface AppManifest {
  appid: string;
  name: string;
  installdir: string;
  StateFlags?: string;
  LastUpdated?: string;
}

export function parseAppManifest(content: string): AppManifest | null {
  try {
    const parsed = vdf.parse(content);
    const appState = parsed?.AppState;

    if (!appState || typeof appState === 'string') return null;

    return {
      appid: appState.appid || '',
      name: appState.name || '',
      installdir: appState.installdir || '',
      StateFlags: appState.StateFlags,
      LastUpdated: appState.LastUpdated,
    };
  } catch (error) {
    console.error('[VDFParser] Error parsing appmanifest:', error);
    return null;
  }
}

/**
 * Parse Steam loginusers.vdf file and get the most recent (active) user
 * Path: <steam_path>/config/loginusers.vdf
 * Returns Steam64 ID of the most recent user, or null if not found
 */
export function parseMostRecentUser(content: string): string | null {
  try {
    const parsed = vdf.parse(content);
    const users = parsed?.users;

    if (!users || typeof users !== 'object') return null;

    let mostRecentUser: string | null = null;
    let highestTimestamp = 0;

    for (const steam64Id of Object.keys(users)) {
      const user = users[steam64Id];
      if (!user || typeof user !== 'object') continue;

      // Check MostRecent flag first (most reliable)
      if (user.MostRecent === '1') {
        return steam64Id;
      }

      // Fallback to timestamp comparison
      const timestamp = parseInt(user.Timestamp || '0', 10);
      if (timestamp > highestTimestamp) {
        highestTimestamp = timestamp;
        mostRecentUser = steam64Id;
      }
    }

    return mostRecentUser;
  } catch (error) {
    console.error('[VDFParser] Error parsing loginusers.vdf:', error);
    return null;
  }
}
