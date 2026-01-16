import * as vdf from '@node-steam/vdf';
import * as fs from 'fs';
import * as path from 'path';
import type { OwnedSteamGame } from '../../shared/types';
import { getSteamPath } from '../game-detector';

export class SteamLibraryService {
  private static instance: SteamLibraryService;

  private constructor() {}

  public static getInstance(): SteamLibraryService {
    if (!SteamLibraryService.instance) {
      SteamLibraryService.instance = new SteamLibraryService();
    }
    return SteamLibraryService.instance;
  }

  /**
   * Get all games owned by the user from localconfig.vdf
   * Iterates through all users found in userdata
   */
  public async getOwnedGames(): Promise<OwnedSteamGame[]> {
    const steamPath = getSteamPath();
    if (!steamPath) {
      console.warn('[SteamLibrary] Steam path not found');
      return [];
    }

    const userdataRoot = path.join(steamPath, 'userdata');
    if (!fs.existsSync(userdataRoot)) {
      console.warn('[SteamLibrary] Userdata directory not found at', userdataRoot);
      return [];
    }

    const ownedGamesMap = new Map<number, OwnedSteamGame>();

    try {
      const userDirs = fs.readdirSync(userdataRoot);

      for (const userId of userDirs) {
        // Skip non-numeric folders (if any)
        if (!/^\d+$/.test(userId)) continue;

        const localConfigPath = path.join(
          userdataRoot,
          userId,
          'config',
          'localconfig.vdf'
        );
        if (fs.existsSync(localConfigPath)) {
          console.log(`[SteamLibrary] Parsing localconfig for user ${userId}`);
          try {
            const content = fs.readFileSync(localConfigPath, 'utf8');
            const data = vdf.parse(content) as any;

            // Navigate to Software -> Valve -> Steam -> apps
            const apps = data?.UserLocalConfigStore?.Software?.Valve?.Steam?.apps;

            if (apps) {
              for (const [appIdStr, appData] of Object.entries(apps)) {
                const appId = parseInt(appIdStr, 10);
                if (isNaN(appId) || appId === 0) continue;

                // We combine data from multiple users if multiple use the same PC.
                // If a game is owned by multiple, we just take the first one or merge playtime?
                // Let's maximize playtime if found multiple times.

                // Note: localconfig.vdf might not have the NAME of the game usually.
                // Actually, localconfig.vdf primarily stores playtime and last played.
                // It DOES NOT always store the game name.
                // We might need to fetch the name from elsewhere or just return ID and depend on other systems to resolve name?
                // BUT the requirement implies we want to show them.
                // Usually appmanifest has names, but we only have appmanifest for INSTALLED games.
                // For UNINSTALLED games, where do we get the name?
                // Steam's appcache/appinfo.vdf has all info but it's binary VDF.
                // `steam-user` can fetch product info.

                // WAIT. If we use `steam-user` anonymously (as we do), we can fetch names for AppIDs!
                // So our flow should be:
                // 1. Get List of AppIDs + Playtime from localconfig.vdf
                // 2. Use `steam-client.ts` (SteamUser) to fetch names for these AppIDs if we don't have them.

                const castedAppData = appData as any;
                const playtime = castedAppData.PlaytimeForever || 0;
                const lastPlayed = castedAppData.LastPlayed || 0;

                if (ownedGamesMap.has(appId)) {
                  const existing = ownedGamesMap.get(appId)!;
                  // Merge: take max playtime
                  existing.playtime_forever = Math.max(
                    existing.playtime_forever,
                    playtime
                  );
                  existing.last_played = Math.max(existing.last_played, lastPlayed);
                } else {
                  ownedGamesMap.set(appId, {
                    appId,
                    name: '', // Placeholder, will need to fetch
                    playtime_forever: playtime,
                    last_played: lastPlayed,
                  });
                }
              }
            }
          } catch (err) {
            console.error(`[SteamLibrary] Error parsing localconfig for ${userId}:`, err);
          }
        }
      }
    } catch (err) {
      console.error('[SteamLibrary] Error reading userdata:', err);
    }

    const games = Array.from(ownedGamesMap.values());
    console.log(
      `[SteamLibrary] Found ${games.length} unique owned games from local config`
    );
    return games;
  }
}
