/**
 * VDF (Valve Data Format) Parser
 *
 * Uses `fast-vdf`'s typed `parse()` API. Other text-VDF libs we tried mangle
 * inputs: @node-steam/vdf and vdf-parser convert quoted numeric strings like
 * "020000000828" to the number 20000000828 (losing the leading zero) and don't
 * re-escape quotes on write, both of which silently corrupt files like
 * localconfig.vdf on round-trip. fast-vdf parses values as strings and decodes
 * escape sequences automatically.
 */

import { parse as vdfParse } from 'fast-vdf';

/**
 * Parse Steam libraryfolders.vdf file
 */
export function parseLibraryFolders(content: string): string[] {
  const root = vdfParse(content);
  const folders = root.dir('libraryfolders', null);
  if (!folders) return [];

  const libraries: string[] = [];
  for (const entry of folders.dirs()) {
    const p = entry.value('path', null);
    if (p) libraries.push(p);
  }
  return libraries;
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
    const appState = vdfParse(content).dir('AppState', null);
    if (!appState) return null;

    return {
      appid: appState.value('appid', '') ?? '',
      name: appState.value('name', '') ?? '',
      installdir: appState.value('installdir', '') ?? '',
      StateFlags: appState.value('StateFlags', undefined),
      LastUpdated: appState.value('LastUpdated', undefined),
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
    const users = vdfParse(content).dir('users', null);
    if (!users) return null;

    let mostRecentUser: string | null = null;
    let highestTimestamp = 0;

    for (const user of users.dirs()) {
      // Check MostRecent flag first (most reliable)
      if (user.value('MostRecent', null) === '1') {
        return user.key;
      }

      // Fallback to timestamp comparison
      const timestamp = parseInt(user.value('Timestamp', '0') ?? '0', 10);
      if (timestamp > highestTimestamp) {
        highestTimestamp = timestamp;
        mostRecentUser = user.key;
      }
    }

    return mostRecentUser;
  } catch (error) {
    console.error('[VDFParser] Error parsing loginusers.vdf:', error);
    return null;
  }
}

/**
 * Steam app playtime data
 */
export interface SteamAppPlaytime {
  /** Total playtime in minutes */
  playtimeMinutes: number;
  /** Last played timestamp (Unix seconds) */
  lastPlayed?: number;
}

/**
 * Parse Steam localconfig.vdf file and extract playtime for all apps
 * Path: userdata/<steamid>/config/localconfig.vdf
 * Structure: UserLocalConfigStore.Software.Valve.Steam.apps.<appid>.Playtime
 * Returns Map of App ID -> playtime in minutes
 */
export function parseLocalConfigPlaytime(content: string): Map<number, SteamAppPlaytime> {
  const playtimes = new Map<number, SteamAppPlaytime>();

  try {
    const apps = vdfParse(content)
      .dir('UserLocalConfigStore', null)
      ?.dir('Software', null)
      ?.dir('Valve', null)
      ?.dir('Steam', null)
      ?.dir('apps', null);
    if (!apps) return playtimes;

    for (const app of apps.dirs()) {
      const appId = parseInt(app.key, 10);
      if (isNaN(appId) || appId <= 10) continue;

      // Steam stores playtime under several differently-cased keys; try each.
      const playtimeStr =
        app.value('Playtime', null) ??
        app.value('playtime', null) ??
        app.value('playtime_forever', null) ??
        app.value('PlaytimeForever', null);
      if (playtimeStr === null) continue;

      const playtimeMinutes = parseInt(playtimeStr, 10);
      if (isNaN(playtimeMinutes) || playtimeMinutes <= 0) continue;

      const lastPlayedStr = app.value('LastPlayed', null) ?? app.value('lastplayed', null);
      const lastPlayed = lastPlayedStr ? parseInt(lastPlayedStr, 10) : undefined;

      playtimes.set(appId, {
        playtimeMinutes,
        lastPlayed: lastPlayed && !isNaN(lastPlayed) ? lastPlayed : undefined,
      });
    }
  } catch (error) {
    console.error('[VDFParser] Error parsing localconfig playtime:', error);
  }

  return playtimes;
}
