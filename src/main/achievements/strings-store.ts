import fs from 'node:fs';
import path from 'node:path';
import { app } from 'electron';
import { z } from 'zod';
import type { ExtractedAchievementStrings } from '@/main/utils/achievement-strings';
import { writeFileAtomic } from '@/main/utils/atomic-write';
import { readJsonFile } from '@/main/utils/json-file';

export type AchievementStrings = ExtractedAchievementStrings['strings'];

const STRINGS_DIR_NAME = 'achievement-strings';
const STRINGS_FILE = /^(\d+)\.json$/;

const achievementText = z.string().min(1).optional().catch(undefined);
const storedEntrySchema = z.object({ name: achievementText, desc: achievementText });

// A malformed entry is skipped, not fatal: the rest of the app's strings still reach Steam.
function cleanStrings(raw: Record<string, unknown>): AchievementStrings {
  const out: AchievementStrings = Object.create(null);
  for (const [apiName, value] of Object.entries(raw)) {
    const { name, desc } = storedEntrySchema.safeParse(value).data ?? {};
    if (name !== undefined || desc !== undefined) {
      out[apiName] = {
        ...(name !== undefined ? { name } : {}),
        ...(desc !== undefined ? { desc } : {}),
      };
    }
  }
  return out;
}

const storedStringsSchema = z.object({
  format: z.literal(1),
  appid: z.number(),
  gameId: z.string(),
  archiveHash: z.string().nullable().catch(null),
  strings: z.record(z.string(), z.unknown()).transform(cleanStrings),
});

type StoredAchievementStrings = z.infer<typeof storedStringsSchema>;

const getStringsDir = (): string => path.join(app.getPath('userData'), STRINGS_DIR_NAME);

function readStoredStrings(appId: number): StoredAchievementStrings | null {
  const entry = readJsonFile(
    path.join(getStringsDir(), `${appId}.json`),
    storedStringsSchema
  );
  return entry?.appid === appId ? entry : null;
}

export function saveAchievementStrings(
  extracted: readonly ExtractedAchievementStrings[],
  gameId: string,
  archiveHash: string | null
): number[] {
  const dir = getStringsDir();
  for (const { appId, strings } of extracted) {
    const entry: StoredAchievementStrings = {
      format: 1,
      appid: appId,
      gameId,
      archiveHash,
      strings,
    };
    fs.mkdirSync(dir, { recursive: true });
    writeFileAtomic(path.join(dir, `${appId}.json`), JSON.stringify(entry));
  }
  return extracted.map(({ appId }) => appId);
}

// Another translation of the same app may own the file; only its owner removes it.
export function removeStoredStrings(appId: number, gameId: string): void {
  const existing = readStoredStrings(appId);
  if (existing && existing.gameId !== gameId) {
    return;
  }
  try {
    fs.rmSync(path.join(getStringsDir(), `${appId}.json`), { force: true });
    console.log(`[Achievements] Removed strings for app ${appId}`);
  } catch (error) {
    console.warn(`[Achievements] Failed to remove strings for app ${appId}:`, error);
  }
}

export function listStoredStrings(): StoredAchievementStrings[] {
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

// An empty list is never "installed": a component without app ids has nothing to deliver.
export function hasAchievementStrings(
  appIds: readonly number[],
  gameId: string
): boolean {
  return (
    appIds.length > 0 &&
    appIds.every((appId) => readStoredStrings(appId)?.gameId === gameId)
  );
}

// Records also vanish outside the uninstall flow (game removed in Steam, stale cache); their strings go too.
export function removeStringsOwnedBy(gameIds: ReadonlySet<string>): boolean {
  let removed = false;
  for (const entry of listStoredStrings()) {
    if (gameIds.has(entry.gameId)) {
      removeStoredStrings(entry.appid, entry.gameId);
      removed = true;
    }
  }
  return removed;
}
