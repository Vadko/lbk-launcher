import { app } from 'electron';
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import { z } from 'zod';
import { Constants } from '../../lib/database.types';
import type { ConflictingTranslation, Game, InstallationInfo } from '../../shared/types';
import { appEvents } from '../app-events';
import { GamesRepository } from '../db/games-repository';
import { getFirstAvailableGamePath } from '../game-detector';
import { readJsonFile } from '../utils/json-file';
import { getWorkshopInstalledGameIds } from '../utils/store-storage';

const mkdir = promisify(fs.mkdir);
const readdir = promisify(fs.readdir);
const unlink = promisify(fs.unlink);

const INSTALLATION_INFO_FILE = '.lbk-translation.json';

const componentSchema = z.looseObject({
  installed: z.boolean(),
  files: z.array(z.string()),
  archiveHash: z.string().optional(),
});

// Loose: a record rewritten from this keeps every field an older or newer LBK wrote.
const installationInfoSchema = z.looseObject({
  gameId: z.string(),
  version: z.string(),
  installedAt: z.string(),
  gamePath: z.string(),
  hasBackup: z.boolean().optional(),
  hasInstallError: z.boolean().optional(),
  protonPath: z.string().optional(),
  isCustomPath: z.boolean().optional(),
  installerPath: z.string().optional(),
  installedFiles: z.array(z.string()).optional(),
  installedPlatform: z.enum(Constants.public.Enums.install_source).optional(),
  components: z
    .looseObject({
      text: componentSchema,
      voice: componentSchema.optional(),
      achievements: componentSchema
        .extend({ appIds: z.array(z.number()).optional() })
        .optional(),
    })
    .optional(),
}) satisfies z.ZodType<InstallationInfo>;

const getInstallationCacheDir = (): string =>
  path.join(app.getPath('userData'), 'installation-cache');

// Cache for installed game IDs
let installedGameIdsCache: string[] | null = null;

// Data kept outside the game folder (achievement strings) must go with the record.
async function removeRecordFile(filePath: string, gameId: string): Promise<void> {
  await unlink(filePath);
  appEvents.emit('install-record-removed', gameId);
}

/**
 * Find the installation info file path, supporting both new and legacy formats.
 * If old format is found, attempts to rename it to the new format.
 * @param gamePath The path to the game installation directory.
 * @returns The path to the installation info file.
 */
export function findInstallationInfoFile(gamePath: string) {
  const oldFormatPath = path.join(gamePath, '.littlebit-translation.json');
  const newFormatPath = path.join(gamePath, INSTALLATION_INFO_FILE);

  if (fs.existsSync(oldFormatPath)) {
    try {
      // Try to rename old format to new format
      fs.renameSync(oldFormatPath, newFormatPath);
      return newFormatPath;
    } catch (error) {
      // If rename fails, return path to old format
      console.warn(
        '[Installer] Failed to rename old format file, using old path:',
        error
      );
      return oldFormatPath;
    }
  }

  return newFormatPath;
}

/**
 * Read installation info written by a previous install. Returns null when
 * the file doesn't exist or is corrupt (caller treats both as "no prior
 * install"). For callers that already know the game path; for the full
 * resolution + library/cache fallback dance use `checkInstallation` instead.
 */
export function readInstallationInfo(gamePath: string): InstallationInfo | null {
  const infoPath = findInstallationInfoFile(gamePath);
  if (!fs.existsSync(infoPath)) {
    return null;
  }
  try {
    return JSON.parse(fs.readFileSync(infoPath, 'utf-8'));
  } catch (error) {
    console.warn('[Installer] Failed to read installation info:', error);
    return null;
  }
}

// A corrupt or mismatched cache entry is skipped: it is the installer's problem, not the caller's.
export function listInstallationRecords(): InstallationInfo[] {
  const dir = getInstallationCacheDir();
  let names: string[];
  try {
    names = fs.readdirSync(dir).filter((name) => name.endsWith('.json'));
  } catch {
    return [];
  }
  return names.flatMap((name) => {
    const info = readJsonFile(path.join(dir, name), installationInfoSchema);
    return info?.gameId === name.slice(0, -'.json'.length) ? [info] : [];
  });
}

// Both copies, since checkInstallation prefers the game folder's; another translation's file there stays untouched.
export async function rewriteInstallationRecord(
  record: InstallationInfo,
  update: (info: InstallationInfo) => InstallationInfo
): Promise<void> {
  try {
    const gameInfoPath = findInstallationInfoFile(record.gamePath);
    const gameInfo = readJsonFile(gameInfoPath, installationInfoSchema);
    if (gameInfo?.gameId === record.gameId) {
      await fs.promises.writeFile(
        gameInfoPath,
        JSON.stringify(update(gameInfo), null, 2),
        'utf-8'
      );
    }
  } catch (error) {
    console.warn(`[Installer] Could not update ${record.gamePath} install info:`, error);
  }
  await fs.promises.writeFile(
    path.join(getInstallationCacheDir(), `${record.gameId}.json`),
    JSON.stringify(update(record), null, 2),
    'utf-8'
  );
}

/**
 * Save installation info to game directory
 */
export async function saveInstallationInfo(
  gamePath: string,
  info: InstallationInfo
): Promise<void> {
  try {
    const infoPath = path.join(gamePath, INSTALLATION_INFO_FILE);
    await fs.promises.writeFile(infoPath, JSON.stringify(info, null, 2), 'utf-8');
    console.log(`[Installer] Installation info saved to: ${infoPath}`);

    // Also save to cache for future lookups (especially for custom paths)
    try {
      const userDataPath = app.getPath('userData');
      const installInfoDir = path.join(userDataPath, 'installation-cache');
      await mkdir(installInfoDir, { recursive: true });
      const cacheInfoPath = path.join(installInfoDir, `${info.gameId}.json`);
      await fs.promises.writeFile(cacheInfoPath, JSON.stringify(info, null, 2), 'utf-8');
      console.log(`[Installer] Installation info cached to: ${cacheInfoPath}`);
    } catch (cacheError) {
      console.warn('[Installer] Failed to cache installation info:', cacheError);
    }
  } catch (error) {
    console.warn('[Installer] Failed to save installation info:', error);
    // Don't throw - installation succeeded even if we can't save the info
  }
}

/**
 * Check if translation is installed and get installation info
 * Priority: Library paths (Steam, GOG, etc.) > Manual/cached paths
 */
export async function checkInstallation(game: Game): Promise<InstallationInfo | null> {
  try {
    console.log(`[Installer] Checking installation for: ${game.id}`);

    // PRIORITY 1: Check standard library paths first (Steam, GOG, Epic, etc.)
    // This ensures that if user installed game via Steam after manual installation,
    // the library path takes priority
    const gamePath = getFirstAvailableGamePath(
      game.install_paths || [],
      game.steam_app_id
    );

    if (gamePath && gamePath.exists) {
      // Check for installation info file in library path
      const infoPath = findInstallationInfoFile(gamePath.path);

      if (fs.existsSync(infoPath)) {
        // Read installation info from library path
        const infoContent = await fs.promises.readFile(infoPath, 'utf-8');
        const info: InstallationInfo = JSON.parse(infoContent);

        // IMPORTANT: Verify that the installed translation matches this game
        // Multiple translations of the same game share the same install path,
        // so we must check gameId to avoid showing wrong version info
        if (info.gameId !== game.id) {
          console.log(
            `[Installer] Different translation installed (${info.gameId}), not ${game.id}`
          );
          return null;
        }

        console.log(
          `[Installer] Translation found in library path: ${gamePath.path}, version ${info.version}`
        );
        console.log(
          `[Installer] Components: voice=${info.components?.voice?.installed}, achievements=${info.components?.achievements?.installed}`
        );

        // Update cache to point to library path (only if changed to avoid triggering watcher loop)
        const userDataPath = app.getPath('userData');
        const installInfoDir = path.join(userDataPath, 'installation-cache');
        const cacheInfoPath = path.join(installInfoDir, `${game.id}.json`);

        try {
          await mkdir(installInfoDir, { recursive: true });

          // Check if cache already has the same data
          let needsUpdate = true;
          if (fs.existsSync(cacheInfoPath)) {
            try {
              const existingContent = await fs.promises.readFile(cacheInfoPath, 'utf-8');
              const existingInfo = JSON.parse(existingContent);
              // Compare key fields and components to avoid unnecessary writes
              const sameComponents =
                existingInfo.components?.voice?.installed ===
                  info.components?.voice?.installed &&
                existingInfo.components?.achievements?.installed ===
                  info.components?.achievements?.installed;

              if (
                existingInfo.gamePath === info.gamePath &&
                existingInfo.version === info.version &&
                existingInfo.gameId === info.gameId &&
                sameComponents
              ) {
                needsUpdate = false;
              }
            } catch {
              // If we can't read existing, we need to update
            }
          }

          if (needsUpdate) {
            await fs.promises.writeFile(
              cacheInfoPath,
              JSON.stringify(info, null, 2),
              'utf-8'
            );
            console.log(`[Installer] Updated cache with library path: ${cacheInfoPath}`);
          }
        } catch (cacheError) {
          console.warn('[Installer] Failed to update cache:', cacheError);
        }

        return info;
      }
    }

    // PRIORITY 2: Check cached/manual installation paths
    // Only if game is NOT found in standard library locations
    const previousInstallInfoPath = getPreviousInstallPath(game.id);
    if (previousInstallInfoPath && fs.existsSync(previousInstallInfoPath)) {
      try {
        const infoContent = await fs.promises.readFile(previousInstallInfoPath, 'utf-8');
        const info: InstallationInfo = JSON.parse(infoContent);

        // Verify the path still exists AND the installation info file exists in game folder
        const gameInfoPath = findInstallationInfoFile(info.gamePath);
        if (fs.existsSync(info.gamePath) && fs.existsSync(gameInfoPath)) {
          // Read the actual file from game folder to verify it's still this translation
          try {
            const actualInfoContent = await fs.promises.readFile(gameInfoPath, 'utf-8');
            const actualInfo: InstallationInfo = JSON.parse(actualInfoContent);

            // Check if the installed translation matches this game
            if (actualInfo.gameId !== game.id) {
              console.log(
                `[Installer] Different translation now installed (${actualInfo.gameId}), clearing cache for ${game.id}`
              );
              await removeRecordFile(previousInstallInfoPath, game.id);
              return null;
            }
          } catch {
            // If we can't read actual file, cache is stale
            console.log(
              '[Installer] Cannot read actual installation file, cache is stale'
            );
            await removeRecordFile(previousInstallInfoPath, game.id);
            return null;
          }

          // Additional check: if this cached path is NOT a library path, use it
          // (library paths were already checked above and didn't have translation)
          console.log(
            `[Installer] Found previous installation at custom path: ${info.gamePath}`
          );
          return info;
        }
        // Cache is stale - game folder or translation was removed
        console.log('[Installer] Cache is stale, removing cached installation info');
        try {
          await removeRecordFile(previousInstallInfoPath, game.id);
        } catch {
          // Ignore deletion errors
        }
      } catch (error) {
        console.warn('[Installer] Failed to read previous installation info:', error);
      }
    }

    // No translation found
    if (!gamePath || !gamePath.exists) {
      console.log(`[Installer] Game not installed on this computer`);
    } else {
      console.log(`[Installer] No translation installed (info file not found)`);
    }

    return null;
  } catch (error) {
    console.error('[Installer] Error checking installation:', error);
    return null;
  }
}

/**
 * Get path to the installation info file from a previous installation
 */
function getPreviousInstallPath(gameId: string): string | null {
  try {
    const userDataPath = app.getPath('userData');
    const installInfoDir = path.join(userDataPath, 'installation-cache');
    const installInfoPath = path.join(installInfoDir, `${gameId}.json`);
    return installInfoPath;
  } catch (error) {
    return null;
  }
}

/**
 * Invalidate the installed game IDs cache
 */
export function invalidateInstalledGameIdsCache(): void {
  console.log('[Installer] Invalidating installed game IDs cache');
  installedGameIdsCache = null;
}

/**
 * Remove orphaned installation metadata (games that no longer exist on disk)
 */
export async function removeOrphanedInstallationMetadata(
  gameIds: string[]
): Promise<void> {
  if (gameIds.length === 0) {
    return;
  }

  console.log(
    `[Installer] Removing ${gameIds.length} orphaned installation metadata files`
  );

  const userDataPath = app.getPath('userData');
  const installInfoDir = path.join(userDataPath, 'installation-cache');

  for (const gameId of gameIds) {
    try {
      const metadataPath = path.join(installInfoDir, `${gameId}.json`);

      if (fs.existsSync(metadataPath)) {
        await removeRecordFile(metadataPath, gameId);
        console.log(`[Installer] Removed metadata for game: ${gameId}`);
      }
    } catch (error) {
      console.error(`[Installer] Error removing metadata for game ${gameId}:`, error);
    }
  }

  // Invalidate cache after cleanup
  invalidateInstalledGameIdsCache();
}

/**
 * Get all installed game IDs from installation cache (with caching)
 */
export async function getAllInstalledGameIds(): Promise<string[]> {
  // Return cached value if available
  if (installedGameIdsCache !== null) {
    console.log(
      `[Installer] Using cached installed games (${installedGameIdsCache.length} games)`
    );
    return installedGameIdsCache;
  }

  try {
    const userDataPath = app.getPath('userData');
    const installInfoDir = path.join(userDataPath, 'installation-cache');

    // Check if directory exists
    if (!fs.existsSync(installInfoDir)) {
      installedGameIdsCache = [];
      return [];
    }

    // Read all files in the directory
    const files = await readdir(installInfoDir);
    const jsonFiles = files.filter((file) => file.endsWith('.json'));

    // Extract game IDs from filenames (errors, if any, are surfaced in the UI)
    const gameIds = jsonFiles.map((file) => file.replace('.json', ''));

    console.log(`[Installer] Found ${gameIds.length} installed games:`, gameIds);

    // Cache the result
    installedGameIdsCache = gameIds;
    return gameIds;
  } catch (error) {
    console.error('[Installer] Error getting installed game IDs:', error);
    installedGameIdsCache = [];
    return [];
  }
}

export async function getLocallyInstalledGameIds(): Promise<Set<string>> {
  return new Set([...(await getAllInstalledGameIds()), ...getWorkshopInstalledGameIds()]);
}

/**
 * Delete cached installation info for a game
 */
export async function deleteCachedInstallationInfo(gameId: string): Promise<void> {
  try {
    const userDataPath = app.getPath('userData');
    const installInfoDir = path.join(userDataPath, 'installation-cache');
    const cacheInfoPath = path.join(installInfoDir, `${gameId}.json`);
    if (fs.existsSync(cacheInfoPath)) {
      await unlink(cacheInfoPath);
      console.log(`[Installer] Deleted cached installation info: ${cacheInfoPath}`);
    }
  } catch (error) {
    console.warn('[Installer] Failed to delete cached installation info:', error);
  }
}

/**
 * Check if there's a different translation installed in the same game folder
 * Returns info about the conflicting translation, or null if no conflict
 */
export async function getConflictingTranslation(
  game: Game
): Promise<ConflictingTranslation | null> {
  try {
    const gamePath = getFirstAvailableGamePath(
      game.install_paths || [],
      game.steam_app_id
    );

    if (!gamePath || !gamePath.exists) {
      return null;
    }

    const infoPath = findInstallationInfoFile(gamePath.path);

    if (!fs.existsSync(infoPath)) {
      return null;
    }

    const infoContent = await fs.promises.readFile(infoPath, 'utf-8');
    const info: InstallationInfo = JSON.parse(infoContent);

    // If it's the same game, no conflict
    if (info.gameId === game.id) {
      return null;
    }

    // Different translation is installed - get game info from DB
    const gamesRepo = GamesRepository.getInstance();
    const conflictingGame = gamesRepo.getGameById(info.gameId);

    console.log(
      `[Installer] Conflicting translation found: ${info.gameId} (installed) vs ${game.id} (requested)`
    );

    return {
      gameId: info.gameId,
      gameName: conflictingGame?.name || 'Невідома локалізація',
      team: conflictingGame?.team || null,
      version: info.version,
      gamePath: gamePath.path,
    };
  } catch (error) {
    console.error('[Installer] Error checking for conflicting translation:', error);
    return null;
  }
}
