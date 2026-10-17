import { G } from '@mobily/ts-belt';
import { hash } from 'crypto';
import { app } from 'electron';
import fs from 'fs';
import path from 'path';
import { GamesRepository } from '@/main/db/games-repository';
import { getSteamPath } from '@/main/game-detector/steam';
import { extractArchive } from '@/main/installer/archive';
import { BACKUP_SUFFIX } from '@/main/installer/backup';
import {
  findInstallationInfoFile,
  getAllInstalledGameIds,
  onInstallationRecordRemoved,
} from '@/main/installer/cache';
import { downloadFile } from '@/main/installer/download';
import { NetworkError, RateLimitError } from '@/main/installer/errors';
import { cleanupDownloadDir, getAllFiles } from '@/main/installer/files';
import { verifyFileHash } from '@/main/installer/hash';
import { getAchievementsBadge } from '@/main/plugin-host/state';
import { deliveryFromBadge } from '@/main/plugin-host/support';
import { getSignedDownloadUrl } from '@/main/tracking';
import {
  type ExtractedAchievementStrings,
  extractAchievementStrings,
  hasOurStrings,
} from '@/main/utils/achievement-strings';
import { writeFileAtomic } from '@/main/utils/atomic-write';
import { writeBridgePluginData } from '@/main/utils/plugin-data';
import {
  invokeViaPlugin,
  isPluginConnected,
  onPluginConnectionChange,
} from '@/main/utils/steam-bridge-server';
import {
  isCefDebuggingEnabledInSettings,
  readStoreValue,
  writeStoreValue,
} from '@/main/utils/store-storage';
import type {
  AchievementsComponent,
  AchievementsDelivery,
  Game,
  InstallationInfo,
} from '@/shared/types';

type AchievementStrings = ExtractedAchievementStrings['strings'];

interface StoredAchievementStrings {
  format: 1;
  appid: number;
  gameId: string;
  archiveHash: string | null;
  strings: AchievementStrings;
}

const STRINGS_DIR_NAME = 'achievement-strings';
const SCHEMA_FILE = /^UserGameStatsSchema_(\d+)\.bin$/i;
const STRINGS_FILE = /^(\d+)\.json$/;
const RELOAD_TIMEOUT_MS = 10_000;
// Lets the catalog sync and the user's own first actions go first.
const REDOWNLOAD_DELAY_MS = 60_000;
// Archives that parsed to zero strings, keyed by game id, so a broken archive is not re-downloaded every start.
const EMPTY_ARCHIVES_KEY = 'achievements-empty-archives';

const getStringsDir = (): string => path.join(app.getPath('userData'), STRINGS_DIR_NAME);

const getInstallationCacheDir = (): string =>
  path.join(app.getPath('userData'), 'installation-cache');

function getSteamStatsDir(): string | null {
  const steamPath = getSteamPath();
  return steamPath ? path.join(steamPath, 'appcache', 'stats') : null;
}

function schemaFileAppId(file: string): number | null {
  const match = SCHEMA_FILE.exec(path.basename(file));
  const appId = match ? Number(match[1]) : NaN;
  return Number.isSafeInteger(appId) && appId > 0 ? appId : null;
}

function readFileOrNull(filePath: string): Buffer | null {
  try {
    return fs.readFileSync(filePath);
  } catch {
    return null;
  }
}

function sanitizeStrings(raw: unknown): AchievementStrings | null {
  if (!G.isObject(raw)) {
    return null;
  }
  const out: AchievementStrings = Object.create(null);
  for (const [apiName, entry] of Object.entries(raw)) {
    if (!G.isObject(entry)) {
      continue;
    }
    const name = typeof entry.name === 'string' && entry.name ? entry.name : undefined;
    const desc = typeof entry.desc === 'string' && entry.desc ? entry.desc : undefined;
    if (name !== undefined || desc !== undefined) {
      out[apiName] = {
        ...(name !== undefined ? { name } : {}),
        ...(desc !== undefined ? { desc } : {}),
      };
    }
  }
  return out;
}

function readStoredStrings(appId: number): StoredAchievementStrings | null {
  const raw = readFileOrNull(path.join(getStringsDir(), `${appId}.json`));
  if (!raw) {
    return null;
  }
  try {
    const parsed: unknown = JSON.parse(raw.toString('utf8'));
    if (
      !G.isObject(parsed) ||
      parsed.format !== 1 ||
      parsed.appid !== appId ||
      typeof parsed.gameId !== 'string'
    ) {
      return null;
    }
    const strings = sanitizeStrings(parsed.strings);
    if (!strings) {
      return null;
    }
    return {
      format: 1,
      appid: appId,
      gameId: parsed.gameId,
      archiveHash: typeof parsed.archiveHash === 'string' ? parsed.archiveHash : null,
      strings,
    };
  } catch {
    return null;
  }
}

function writeStoredStrings(entry: StoredAchievementStrings): void {
  const dir = getStringsDir();
  fs.mkdirSync(dir, { recursive: true });
  writeFileAtomic(path.join(dir, `${entry.appid}.json`), JSON.stringify(entry));
}

// Another translation of the same app may own the file; only its owner removes it.
function removeStoredStrings(appId: number, gameId: string): void {
  const filePath = path.join(getStringsDir(), `${appId}.json`);
  const existing = readStoredStrings(appId);
  if (existing && existing.gameId !== gameId) {
    return;
  }
  try {
    fs.rmSync(filePath, { force: true });
    console.log(`[Achievements] Removed strings for app ${appId}`);
  } catch (error) {
    console.warn(`[Achievements] Failed to remove strings for app ${appId}:`, error);
  }
}

function listStoredStrings(): StoredAchievementStrings[] {
  let names: string[];
  try {
    names = fs.readdirSync(getStringsDir());
  } catch {
    return [];
  }
  const out: StoredAchievementStrings[] = [];
  for (const name of names) {
    const match = STRINGS_FILE.exec(name);
    const entry = match ? readStoredStrings(Number(match[1])) : null;
    if (entry) {
      out.push(entry);
    }
  }
  return out.sort((a, b) => a.appid - b.appid);
}

export function hasAchievementStrings(
  appIds: readonly number[],
  gameId: string
): boolean {
  return appIds.every((appId) => readStoredStrings(appId)?.gameId === gameId);
}

// Parses every schema in an extracted achievements archive; schemas without Ukrainian strings are dropped.
export async function readAchievementStringsFromDir(
  dir: string
): Promise<ExtractedAchievementStrings[]> {
  const byApp = new Map<number, ExtractedAchievementStrings>();
  for (const relativePath of await getAllFiles(dir)) {
    const fileName = path.basename(relativePath);
    if (!SCHEMA_FILE.test(fileName)) {
      continue;
    }
    try {
      const buf = await fs.promises.readFile(path.join(dir, relativePath));
      const extracted = extractAchievementStrings(buf, fileName);
      const count = Object.keys(extracted.strings).length;
      if (count === 0) {
        console.warn(`[Achievements] ${fileName} has no Ukrainian strings`);
        continue;
      }
      byApp.set(extracted.appId, extracted);
      console.log(
        `[Achievements] ${fileName}: ${count} strings for app ${extracted.appId}`
      );
    } catch (error) {
      console.warn(`[Achievements] Failed to parse ${fileName}:`, error);
    }
  }
  return [...byApp.values()];
}

export function saveAchievementStrings(
  extracted: readonly ExtractedAchievementStrings[],
  gameId: string,
  archiveHash: string | null
): number[] {
  for (const { appId, strings } of extracted) {
    writeStoredStrings({ format: 1, appid: appId, gameId, archiveHash, strings });
  }
  return extracted.map(({ appId }) => appId);
}

// Steam replaces a modified schema from the server anyway; restoring or deleting ours only stops it fetching twice.
async function removeLegacyStatsFile(fullPath: string): Promise<boolean> {
  const backupPath = fullPath + BACKUP_SUFFIX;
  const isSchema = schemaFileAppId(fullPath) !== null;
  const current = readFileOrNull(fullPath);
  const ours = isSchema && current !== null && hasOurStrings(current);
  try {
    if (fs.existsSync(backupPath)) {
      if (ours || current === null) {
        await fs.promises.rename(backupPath, fullPath);
        console.log(`[Achievements] Restored ${path.basename(fullPath)} from backup`);
      } else if (isSchema) {
        // Steam already put its own copy back, so our backup is older than what it replaced.
        await fs.promises.unlink(backupPath);
      }
    } else if (ours) {
      await fs.promises.unlink(fullPath);
      console.log(`[Achievements] Deleted legacy ${path.basename(fullPath)}`);
    }
    return true;
  } catch (error) {
    console.warn(`[Achievements] Failed to clean up ${fullPath}:`, error);
    return false;
  }
}

// Strings in `keepAppIds` stay: a reinstall has just rewritten them.
export async function removeInstalledAchievements(
  gameId: string,
  component: Pick<AchievementsComponent, 'files' | 'appIds'>,
  keepAppIds: ReadonlySet<number> = new Set()
): Promise<void> {
  const appIds = new Set(component.appIds ?? []);
  const statsDir = component.files.length > 0 ? getSteamStatsDir() : null;
  for (const file of component.files) {
    const appId = schemaFileAppId(file);
    if (appId !== null) {
      appIds.add(appId);
    }
    if (statsDir) {
      await removeLegacyStatsFile(path.join(statsDir, path.basename(file)));
    }
  }
  for (const appId of appIds) {
    if (!keepAppIds.has(appId)) {
      removeStoredStrings(appId, gameId);
    }
  }
}

// Records also vanish outside the uninstall flow (game removed in Steam, stale cache); their strings go too.
function removeStringsOwnedBy(gameIds: ReadonlySet<string>): boolean {
  let removed = false;
  for (const entry of listStoredStrings()) {
    if (gameIds.has(entry.gameId)) {
      removeStoredStrings(entry.appid, entry.gameId);
      removed = true;
    }
  }
  return removed;
}

// Startup only: no install is in flight yet, so strings without a record are orphans.
async function pruneOrphanStrings(): Promise<void> {
  const installed = new Set(await getAllInstalledGameIds());
  const orphans = new Set(
    listStoredStrings()
      .map((entry) => entry.gameId)
      .filter((gameId) => !installed.has(gameId))
  );
  removeStringsOwnedBy(orphans);
}

async function computeDelivery(reloaded: boolean): Promise<AchievementsDelivery> {
  try {
    return deliveryFromBadge(await getAchievementsBadge(), reloaded);
  } catch (error) {
    console.warn('[Achievements] Delivery check failed:', error);
    return isCefDebuggingEnabledInSettings() ? 'unavailable' : 'disabled';
  }
}

async function syncNow(): Promise<AchievementsDelivery> {
  try {
    const apps: Record<string, AchievementStrings> = {};
    for (const entry of listStoredStrings()) {
      apps[String(entry.appid)] = entry.strings;
    }
    const stamp = hash('sha1', JSON.stringify(apps)).slice(0, 16);
    writeBridgePluginData('achievements.json', { v: 1, stamp, apps });

    if (!isCefDebuggingEnabledInSettings() || !isPluginConnected()) {
      return computeDelivery(false);
    }
    try {
      const result = await invokeViaPlugin('achievementsReload', {}, RELOAD_TIMEOUT_MS);
      console.log(
        `[Achievements] Plugin reloaded ${result.apps} apps, coverage ${JSON.stringify(result.coverage)}`
      );
      return computeDelivery(true);
    } catch (error) {
      console.warn('[Achievements] Plugin reload failed:', error);
      return computeDelivery(false);
    }
  } catch (error) {
    console.warn('[Achievements] Sync to plugin failed:', error);
    return computeDelivery(false);
  }
}

let syncQueue: Promise<unknown> = Promise.resolve();

// Never rejects. Serialised so an install and a plugin reconnect cannot interleave writes.
export function syncAchievementsToPlugin(): Promise<AchievementsDelivery> {
  const run = syncQueue.then(syncNow, syncNow);
  syncQueue = run;
  return run;
}

function readInstallationCacheEntries(): InstallationInfo[] {
  const dir = getInstallationCacheDir();
  let names: string[];
  try {
    names = fs.readdirSync(dir).filter((name) => name.endsWith('.json'));
  } catch {
    return [];
  }
  const out: InstallationInfo[] = [];
  for (const name of names) {
    try {
      const parsed: unknown = JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8'));
      if (
        G.isObject(parsed) &&
        parsed.gameId === name.slice(0, -'.json'.length) &&
        typeof parsed.gamePath === 'string'
      ) {
        out.push(parsed as unknown as InstallationInfo);
      }
    } catch {
      // A corrupt cache entry is the installer's problem, not the migration's.
    }
  }
  return out;
}

function readCacheEntry(gameId: string): InstallationInfo | null {
  return readInstallationCacheEntries().find((info) => info.gameId === gameId) ?? null;
}

// Both copies are rewritten: checkInstallation prefers the game folder's file over the cache.
async function rewriteAchievementsComponent(
  info: InstallationInfo,
  component: AchievementsComponent
): Promise<void> {
  const withComponent = (i: InstallationInfo): InstallationInfo => ({
    ...i,
    components: {
      ...(i.components ?? { text: { installed: false, files: [] } }),
      achievements: component,
    },
  });

  try {
    const gameInfoPath = findInstallationInfoFile(info.gamePath);
    const raw = readFileOrNull(gameInfoPath);
    if (raw) {
      const gameInfo = JSON.parse(raw.toString('utf8')) as InstallationInfo;
      if (gameInfo.gameId === info.gameId) {
        await fs.promises.writeFile(
          gameInfoPath,
          JSON.stringify(withComponent(gameInfo), null, 2),
          'utf-8'
        );
      }
    }
  } catch (error) {
    console.warn(`[Achievements] Could not update ${info.gamePath} install info:`, error);
  }

  await fs.promises.writeFile(
    path.join(getInstallationCacheDir(), `${info.gameId}.json`),
    JSON.stringify(withComponent(info), null, 2),
    'utf-8'
  );
}

async function migrateLegacyFiles(): Promise<boolean> {
  let changed = false;
  for (const info of readInstallationCacheEntries()) {
    const component = info.components?.achievements;
    if (!component?.installed || component.files.length === 0) {
      continue;
    }
    const statsDir = getSteamStatsDir();
    if (!statsDir) {
      console.warn('[Achievements] Steam not found, legacy migration postponed');
      return changed;
    }

    const appIds = new Set(component.appIds ?? []);
    let clean = true;
    for (const file of component.files) {
      const fileName = path.basename(file);
      const fullPath = path.join(statsDir, fileName);
      const appId = schemaFileAppId(fileName);
      if (appId !== null) {
        appIds.add(appId);
        const buf = readFileOrNull(fullPath);
        if (buf && hasOurStrings(buf) && !readStoredStrings(appId)) {
          try {
            const extracted = extractAchievementStrings(buf, fileName);
            if (Object.keys(extracted.strings).length > 0) {
              saveAchievementStrings(
                [extracted],
                info.gameId,
                component.archiveHash ?? null
              );
              appIds.add(extracted.appId);
              console.log(`[Achievements] Migrated strings for app ${extracted.appId}`);
            }
          } catch (error) {
            console.warn(`[Achievements] Could not extract legacy ${fileName}:`, error);
          }
        }
      }
      if (!(await removeLegacyStatsFile(fullPath))) {
        clean = false;
      }
    }

    if (!clean) {
      continue;
    }
    try {
      await rewriteAchievementsComponent(info, {
        ...component,
        files: [],
        appIds: [...appIds],
      });
      changed = true;
      console.log(`[Achievements] Migrated legacy install of ${info.gameId}`);
    } catch (error) {
      console.warn(
        `[Achievements] Could not rewrite install info of ${info.gameId}:`,
        error
      );
    }
  }
  return changed;
}

function readEmptyArchives(): Record<string, string> {
  const value = readStoreValue(EMPTY_ARCHIVES_KEY);
  if (!G.isObject(value)) {
    return {};
  }
  const out: Record<string, string> = {};
  for (const [gameId, hash] of Object.entries(value)) {
    if (typeof hash === 'string') {
      out[gameId] = hash;
    }
  }
  return out;
}

// Bypasses downloadAndExtractArchive on purpose: it owns the global abort controller of the user's install.
async function downloadAchievementStrings(
  game: Game,
  archivePath: string
): Promise<ExtractedAchievementStrings[]> {
  const workDir = path.join(app.getPath('temp'), 'lbk-achievements', game.id);
  await cleanupDownloadDir(workDir);
  await fs.promises.mkdir(workDir, { recursive: true });
  try {
    const urlResult = await getSignedDownloadUrl({
      gameId: game.id,
      archivePath,
      archiveType: 'achievements',
      isFirstSession: false,
    });
    if (!urlResult.success) {
      if (urlResult.error === 'rate_limit_exceeded' && 'nextAvailableAt' in urlResult) {
        throw new RateLimitError(
          urlResult.nextAvailableAt,
          urlResult.downloadsToday,
          urlResult.maxAllowed
        );
      }
      throw new Error(`Signed URL failed: ${urlResult.error}`);
    }

    const archiveFile = path.join(
      workDir,
      `${game.id}_achievements${path.extname(archivePath) || '.zip'}`
    );
    await downloadFile(urlResult.downloadUrl, archiveFile);
    if (
      game.achievements_archive_hash &&
      !(await verifyFileHash(archiveFile, game.achievements_archive_hash))
    ) {
      throw new Error('Archive hash mismatch');
    }
    const extractDir = path.join(workDir, 'extract');
    await extractArchive(archiveFile, extractDir);
    return await readAchievementStringsFromDir(extractDir);
  } finally {
    await cleanupDownloadDir(workDir);
  }
}

async function redownloadMissingStrings(): Promise<boolean> {
  if ((await computeDelivery(false)) !== 'plugin-next-start') {
    return false;
  }

  let changed = false;
  for (const info of readInstallationCacheEntries()) {
    const component = info.components?.achievements;
    if (!component?.installed || component.files.length > 0) {
      continue;
    }
    const appIds = component.appIds ?? [];
    if (appIds.length > 0 && hasAchievementStrings(appIds, info.gameId)) {
      continue;
    }

    let game: Game | null = null;
    try {
      game = GamesRepository.getInstance().getGameById(info.gameId);
    } catch (error) {
      console.warn('[Achievements] Catalog unavailable, re-download postponed:', error);
      return changed;
    }
    const archivePath = game?.achievements_archive_path;
    if (!game || !archivePath) {
      continue;
    }
    const archiveHash = game.achievements_archive_hash ?? null;
    const emptyArchives = readEmptyArchives();
    if (archiveHash && emptyArchives[game.id] === archiveHash) {
      continue;
    }

    console.log(`[Achievements] Re-downloading achievement strings for ${game.id}`);
    try {
      const extracted = await downloadAchievementStrings(game, archivePath);
      if (extracted.length === 0) {
        console.error(`[Achievements] Archive of ${game.id} has no Ukrainian strings`);
        if (archiveHash) {
          writeStoreValue(EMPTY_ARCHIVES_KEY, {
            ...emptyArchives,
            [game.id]: archiveHash,
          });
        }
        continue;
      }
      const current = readCacheEntry(info.gameId);
      if (!current?.components?.achievements?.installed) {
        continue;
      }
      const savedAppIds = saveAchievementStrings(extracted, game.id, archiveHash);
      await rewriteAchievementsComponent(current, {
        ...current.components.achievements,
        files: [],
        appIds: savedAppIds,
        ...(archiveHash ? { archiveHash } : {}),
      });
      changed = true;
    } catch (error) {
      if (error instanceof NetworkError) {
        console.warn('[Achievements] Network unavailable, re-download postponed');
        return changed;
      }
      if (error instanceof RateLimitError) {
        console.warn(`[Achievements] Rate-limited for ${game.id}, retrying next start`);
        continue;
      }
      console.warn(`[Achievements] Re-download for ${game.id} failed:`, error);
    }
  }
  return changed;
}

async function migrateLegacyAchievements(): Promise<void> {
  try {
    if (await migrateLegacyFiles()) {
      await syncAchievementsToPlugin();
    }
  } catch (error) {
    console.warn('[Achievements] Legacy migration failed:', error);
  }

  setTimeout(() => {
    redownloadMissingStrings()
      .then((changed) => (changed ? syncAchievementsToPlugin() : undefined))
      .catch((error: unknown) => {
        console.warn('[Achievements] Legacy re-download failed:', error);
      });
  }, REDOWNLOAD_DELAY_MS);
}

let started = false;

// Call once from app startup, inside the single-instance branch.
export function startAchievements(): void {
  if (started) {
    return;
  }
  started = true;
  onPluginConnectionChange((connected) => {
    if (connected) {
      void syncAchievementsToPlugin();
    }
  });
  onInstallationRecordRemoved((gameId) => {
    if (removeStringsOwnedBy(new Set([gameId]))) {
      void syncAchievementsToPlugin();
    }
  });
  void pruneOrphanStrings()
    .catch((error: unknown) =>
      console.warn('[Achievements] Orphan cleanup failed:', error)
    )
    .finally(() => void syncAchievementsToPlugin());
  void migrateLegacyAchievements();
}
