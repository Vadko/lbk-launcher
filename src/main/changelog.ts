import { ipcMain, net } from 'electron';
import { REPO_RAW_BASE } from '../shared/repo';
import type { ChangelogEntry } from '../shared/types';

const CHANGELOG_PATH = 'src/shared/changelog.json';
const FETCH_TIMEOUT_MS = 10000;

const cache = new Map<string, ChangelogEntry[] | null>();

function isChangelogEntry(value: unknown): value is ChangelogEntry {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const entry = value as Record<string, unknown>;
  return (
    typeof entry.version === 'string' &&
    typeof entry.date === 'string' &&
    typeof entry.title === 'string' &&
    Array.isArray(entry.highlights) &&
    entry.highlights.every((item) => typeof item === 'string')
  );
}

async function fetchFromTag(version: string): Promise<ChangelogEntry[] | null> {
  const res = await net.fetch(`${REPO_RAW_BASE}/v${version}/${CHANGELOG_PATH}`, {
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!res.ok) {
    return null;
  }
  const parsed: unknown = await res.json();
  if (!Array.isArray(parsed)) {
    return null;
  }
  const entries = parsed.filter(isChangelogEntry);
  return entries.length > 0 ? entries : null;
}

async function fetchChangelog(version: string): Promise<ChangelogEntry[] | null> {
  const cached = cache.get(version);
  if (cached !== undefined) {
    return cached;
  }

  try {
    const entries = await fetchFromTag(version);
    cache.set(version, entries);
    return entries;
  } catch (error) {
    console.error('[Changelog] Fetch failed:', error);
    return null;
  }
}

export function setupChangelogHandlers(): void {
  ipcMain.handle('fetch-changelog', (_, version: string) => fetchChangelog(version));
}
