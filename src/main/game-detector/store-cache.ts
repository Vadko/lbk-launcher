import { D } from '@mobily/ts-belt';
import * as fs from 'fs';
import { LRUCache } from 'lru-cache';
import * as path from 'path';
import { getInstalledEAGamePaths } from './ea';
import { getEglInstallationsPath } from './egl-linux';
import {
  getEpicManifestsCandidatePath,
  getInstalledEpicGamePaths,
  getEpicLibrary as probeEpicLibrary,
} from './epic';
import {
  getGOGGalaxyDBCandidatePath,
  getInstalledGOGGamePaths,
  getGogLibrary as probeGogLibrary,
} from './gog';
import { getHeroicConfigPaths, getHeroicGamePaths } from './heroic';
import { getLutrisDBCandidatePaths } from './lutris';
import { getInstalledRockstarGamePaths } from './rockstar';
import { getInstalledUplayGamePaths } from './uplay';
import { getXboxRootPaths, getInstalledXboxGamePaths as probeXboxGames } from './xbox';

// Store probes open SQLite DBs and parse JSON, so results are reused until their sources change

type StoreId =
  | 'gog-installed'
  | 'gog-library'
  | 'epic-installed'
  | 'epic-library'
  | 'xbox-installed'
  | 'registry-installed';

function fileStamp(filePath: string): string {
  try {
    const stat = fs.statSync(filePath, { throwIfNoEntry: false });
    return stat ? `${filePath}:${stat.mtimeMs}:${stat.size}` : `${filePath}:-`;
  } catch {
    return `${filePath}:!`;
  }
}

function dirNames(dirPath: string, filter: (name: string) => boolean = () => true) {
  try {
    return fs.readdirSync(dirPath).filter(filter).sort();
  } catch {
    return null;
  }
}

function dirStamp(dirPath: string): string {
  return `${dirPath}[${dirNames(dirPath)?.join('|') ?? '-'}]`;
}

function dirFileStamps(dirPath: string, filter: (name: string) => boolean): string {
  const names = dirNames(dirPath, filter);
  return names
    ? names.map((name) => fileStamp(path.join(dirPath, name))).join(',')
    : `${dirPath}:-`;
}

// SQLite in WAL mode commits into -wal; the main file only changes on checkpoint
const sqliteFiles = (dbPath: string) => [dbPath, `${dbPath}-wal`];

const heroicFiles = (relative: string[]) =>
  getHeroicConfigPaths().flatMap((root) => relative.map((file) => path.join(root, file)));

function gogFingerprint(): string {
  const galaxyDb = getGOGGalaxyDBCandidatePath();
  return [
    ...(galaxyDb ? sqliteFiles(galaxyDb) : []),
    ...heroicFiles(['gog_store/installed.json', 'store_cache/gog_library.json']),
    ...getLutrisDBCandidatePaths().flatMap(sqliteFiles),
  ]
    .map(fileStamp)
    .concat(getHeroicGamePaths().map(dirStamp))
    .join(';');
}

function epicFingerprint(): string {
  const manifests = getEpicManifestsCandidatePath();
  const eglLog = getEglInstallationsPath();
  return [
    ...(eglLog ? [eglLog] : []),
    ...heroicFiles([
      'store_cache/legendary_library.json',
      'store_cache/legendary_install_info.json',
      // Epic installs are the Heroic folders minus the GOG ones listed here
      'gog_store/installed.json',
    ]),
    ...getLutrisDBCandidatePaths().flatMap(sqliteFiles),
  ]
    .map(fileStamp)
    .concat(getHeroicGamePaths().map(dirStamp))
    .concat(manifests ? [dirFileStamps(manifests, (name) => name.endsWith('.item'))] : [])
    .join(';');
}

function xboxFingerprint(): string {
  return getXboxRootPaths().map(dirStamp).join(';');
}

function registryProbe(): string[] {
  const probes = [
    ['Rockstar', getInstalledRockstarGamePaths],
    ['Uplay', getInstalledUplayGamePaths],
    ['EA', getInstalledEAGamePaths],
  ] as const;
  return probes.flatMap(([name, probe]) => {
    try {
      return probe();
    } catch (error) {
      console.error(`[GameDetector] Error getting ${name} games:`, error);
      return [];
    }
  });
}

const resultKey = (value: string[]) => [...value].sort().join('\n');

// The first probe of each store is the baseline revalidateStores() compares against
const lastSeen = new Map<StoreId, string>();

function recordBaseline(id: StoreId, value: string[]): string[] {
  if (!lastSeen.has(id)) {
    lastSeen.set(id, resultKey(value));
  }
  return value;
}

type FileStoreId = Exclude<StoreId, 'registry-installed'>;

// Keyed by fingerprint: a changed file yields a new key, and max: 1 drops the old result
function fingerprintCache(
  id: FileStoreId,
  fingerprint: () => string,
  probe: () => string[]
) {
  const cache = new LRUCache<string, string[]>({
    max: 1,
    memoMethod: () => recordBaseline(id, probe()),
  });
  return { get: () => cache.memo(fingerprint()), reset: () => cache.clear() };
}

const FILE_STORES = {
  'gog-installed': fingerprintCache(
    'gog-installed',
    gogFingerprint,
    getInstalledGOGGamePaths
  ),
  'gog-library': fingerprintCache('gog-library', gogFingerprint, probeGogLibrary),
  'epic-installed': fingerprintCache(
    'epic-installed',
    epicFingerprint,
    getInstalledEpicGamePaths
  ),
  'epic-library': fingerprintCache('epic-library', epicFingerprint, probeEpicLibrary),
  'xbox-installed': fingerprintCache('xbox-installed', xboxFingerprint, probeXboxGames),
} satisfies Record<FileStoreId, ReturnType<typeof fingerprintCache>>;

export const getInstalledGOGGamePathsCached = () => FILE_STORES['gog-installed'].get();
export const getGogLibrary = () => FILE_STORES['gog-library'].get();
export const getInstalledEpicGamePathsCached = () => FILE_STORES['epic-installed'].get();
export const getEpicLibrary = () => FILE_STORES['epic-library'].get();
export const getInstalledXboxGamePaths = () => FILE_STORES['xbox-installed'].get();
// Registry reads are native calls, cheap enough to repeat instead of caching without a way to tell when keys change
export const getInstalledRegistryGamePaths = () =>
  recordBaseline('registry-installed', registryProbe());

// force re-probes file stores despite a matching fingerprint (probes also check install folders it can't see)
export function revalidateStores(force: boolean): StoreId[] {
  if (force) {
    for (const store of Object.values(FILE_STORES)) {
      store.reset();
    }
  }
  const results: Record<StoreId, string[]> = {
    ...D.map(FILE_STORES, (store) => store.get()),
    'registry-installed': getInstalledRegistryGamePaths(),
  };
  return D.keys(results).filter((id) => {
    const value = resultKey(results[id]);
    const previous = lastSeen.get(id);
    lastSeen.set(id, value);
    return previous !== undefined && previous !== value;
  });
}

/** Existing directories whose changes can change a store result. */
export function getStoreWatchDirs(): string[] {
  const galaxyDb = getGOGGalaxyDBCandidatePath();
  const manifests = getEpicManifestsCandidatePath();
  const eglLog = getEglInstallationsPath();
  const dirs = [
    ...(galaxyDb ? [path.dirname(galaxyDb)] : []),
    ...(manifests ? [manifests] : []),
    ...(eglLog ? [path.dirname(eglLog)] : []),
    ...getHeroicConfigPaths().flatMap((root) => [
      path.join(root, 'gog_store'),
      path.join(root, 'store_cache'),
    ]),
    ...getHeroicGamePaths(),
    ...getLutrisDBCandidatePaths().map((dbPath) => path.dirname(dbPath)),
  ];
  return [...new Set(dirs)].filter((dir) => fs.existsSync(dir));
}
