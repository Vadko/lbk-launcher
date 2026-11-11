import * as fs from 'node:fs';
import * as path from 'node:path';
import { A, F } from '@mobily/ts-belt';
import { LRUCache } from 'lru-cache';
import { z } from 'zod';
import { appEvents } from '@/main/app-events';
import { isMacOS } from '@/main/utils/platform';
import { readStoreValue, writeStoreValue } from '@/main/utils/store-storage';
import type { AddWinePrefixResult, WinePrefixRef } from '@/shared/wine-types';
import {
  crossOverBottleDirs,
  isCrossOverBottle,
  listBottlesIn,
  readCrossOverBottleDirDefault,
} from './crossover';
import { isWinePrefix, winePrefixOf } from './dos-path';

const USER_PREFIXES_KEY = 'wine-prefixes';

const userPrefixesSchema = z.array(z.string());

function readUserPrefixes(): string[] {
  const parsed = userPrefixesSchema.safeParse(readStoreValue(USER_PREFIXES_KEY));
  return parsed.success ? parsed.data : [];
}

function prefixRef(prefix: string): WinePrefixRef {
  return {
    launcher: isCrossOverBottle(prefix) ? 'crossover' : 'manual',
    prefix,
    label: path.basename(prefix),
  };
}

/** The prefix a host path lies in, whether or not LBK listed it; macOS only, since a Lutris or Proton prefix on Linux runs through Proton. */
export function winePrefixRefOf(hostPath: string): WinePrefixRef | null {
  const prefix = isMacOS() ? winePrefixOf(hostPath) : null;
  return prefix === null ? null : prefixRef(prefix);
}

const guiBottleDir: LRUCache<'dir', { dir: string | null }> = new LRUCache({
  max: 1,
  fetchMethod: async () => ({ dir: await readCrossOverBottleDirDefault() }),
  ignoreFetchAbort: true,
});

/** The folders CrossOver keeps its bottles in, the GUI's own setting first. */
function wineBottleDirs(): readonly string[] {
  const guiDir = guiBottleDir.get('dir')?.dir;
  return A.uniq([...(guiDir ? [guiDir] : []), ...crossOverBottleDirs()]);
}

function scanPrefixes(): readonly WinePrefixRef[] {
  if (!isMacOS()) {
    return [];
  }
  const found = [
    ...wineBottleDirs().flatMap(listBottlesIn),
    ...readUserPrefixes().filter(isWinePrefix),
  ];
  return A.uniqBy(found.map(prefixRef), (ref) => ref.prefix);
}

const snapshot: LRUCache<'all', { prefixes: readonly WinePrefixRef[] }> = new LRUCache({
  max: 1,
  ttl: 30_000,
  memoMethod: () => ({ prefixes: scanPrefixes() }),
});

/** Wine prefixes on this Mac, from a short-lived snapshot so the synchronous detectors can read it. */
export function listWinePrefixes(): readonly WinePrefixRef[] {
  return snapshot.memo('all').prefixes;
}

function snapshotKey(): string {
  return listWinePrefixes()
    .map((ref) => ref.prefix)
    .join('|');
}

// The set the listeners last saw: an expired snapshot rescans on read, so it cannot be the baseline
const published: { key?: string } = {};

/** Rescans now and tells the listeners only when the set of prefixes changed. */
function refreshWinePrefixes(): void {
  snapshot.clear();
  const key = snapshotKey();
  const changed = published.key !== undefined && key !== published.key;
  published.key = key;
  if (changed) {
    appEvents.emit('wine-prefixes-changed');
  }
}

const rescanSoon = F.debounce(refreshWinePrefixes, 2000);

// A bottle created or deleted in CrossOver shows up without a restart
function watchBottleDirs(): void {
  for (const dir of wineBottleDirs()) {
    try {
      fs.watch(dir, () => rescanSoon()).on('error', (error) => {
        console.warn(`[Wine] Bottle folder watch stopped: ${dir}`, error);
      });
    } catch {
      // A folder that does not exist yet has no bottles to watch
    }
  }
}

export const startWinePrefixes = F.once(async (): Promise<void> => {
  if (!isMacOS()) {
    return;
  }
  await guiBottleDir.fetch('dir');
  refreshWinePrefixes();
  watchBottleDirs();
  console.log(
    `[Wine] Prefixes: ${
      listWinePrefixes()
        .map((ref) => ref.prefix)
        .join(', ') || 'none'
    }`
  );
});

/** Takes the prefix folder itself or any folder inside it, such as drive_c or a game folder. */
export function addUserWinePrefix(dir: string): AddWinePrefixResult {
  const prefix = isWinePrefix(dir) ? path.resolve(dir) : winePrefixOf(dir);
  if (prefix === null) {
    return { success: false, error: 'not-a-prefix' };
  }
  refreshWinePrefixes();
  // A bottle LBK already finds keeps no entry of its own, which would show it as hand-added
  if (!listWinePrefixes().some((ref) => ref.prefix === prefix)) {
    writeStoreValue(USER_PREFIXES_KEY, [...readUserPrefixes(), prefix]);
    refreshWinePrefixes();
  }
  return { success: true, prefix: prefixRef(prefix) };
}

export function removeUserWinePrefix(prefix: string): void {
  writeStoreValue(
    USER_PREFIXES_KEY,
    readUserPrefixes().filter((entry) => entry !== prefix)
  );
  refreshWinePrefixes();
}

export function isUserWinePrefix(prefix: string): boolean {
  return readUserPrefixes().includes(prefix);
}
