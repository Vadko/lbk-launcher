import type Database from 'better-sqlite3';
import Chance from 'chance';
import { getDatabase } from './database';
import { parseTagIds, VISIBLE_GAMES_SQL } from './db-queries';

/**
 * Динамічні рекомендації за перетином Steam-тегів (games.steam_tag_ids,
 * синкається з адмінки): 2 популярні + 1 андердог, ротація раз на 3 дні.
 * ШІ-переклади рекомендуються, доки юзер не ввімкнув «Приховати ШІ-переклади».
 */

const OVERLAP_THRESHOLD = 0.5;
const RESULT_SIZE = 3;
const UNDERDOG_SHARE = 1 / 3;
const ROTATION_WINDOW_MS = 3 * 24 * 3600 * 1000;
const POOL_SIZE = RESULT_SIZE * 3;

interface SourceRow {
  slug: string;
  steam_app_id: number | null;
  steam_tag_ids: string | null;
}

interface CandidateRow {
  id: string;
  slug: string;
  steam_app_id: number | null;
  downloads: number | null;
  steam_tag_ids: string;
}

interface Candidate {
  id: string;
  slug: string;
  gameKey: string;
  downloads: number;
  score: number;
}

// кеш на епоху: стабільність набору між навігаціями і нуль повторних сканів.
// Порожні результати НЕ кешуємо: інакше секція, порахована до завершення
// синку, лишалась би порожньою до кінця епохи
const memo = new Map<string, { epoch: number; ids: string[] }>();

function parseTags(json: string): Set<number> {
  return new Set(parseTagIds(json) ?? []);
}

function loadCandidates(
  db: Database.Database,
  gameId: string,
  source: SourceRow,
  hideAiTranslations: boolean
): CandidateRow[] {
  return db
    .prepare(
      `SELECT id, slug, steam_app_id, downloads, steam_tag_ids
       FROM games
       WHERE ${VISIBLE_GAMES_SQL}
         ${hideAiTranslations ? 'AND ai IS NULL' : ''}
         AND status != 'tech-improvement'
         AND id != ?
         AND slug != ?
         AND (? IS NULL OR steam_app_id IS NULL OR steam_app_id != ?)
         AND steam_tag_ids IS NOT NULL`
    )
    .all(gameId, source.slug, source.steam_app_id, source.steam_app_id) as CandidateRow[];
}

function scoreCandidates(rows: CandidateRow[], sourceTags: Set<number>): Candidate[] {
  return rows.flatMap((row) => {
    const shared = [...parseTags(row.steam_tag_ids)].filter((t) =>
      sourceTags.has(t)
    ).length;
    if (shared === 0) {
      return [];
    }
    return {
      id: row.id,
      slug: row.slug,
      gameKey: row.steam_app_id != null ? `app:${row.steam_app_id}` : `slug:${row.slug}`,
      downloads: row.downloads ?? 0,
      score: shared / sourceTags.size,
    };
  });
}

function dedupeTranslations(candidates: Candidate[]): Candidate[] {
  const better = (a: Candidate, b: Candidate) =>
    a.downloads > b.downloads ||
    (a.downloads === b.downloads && a.id.localeCompare(b.id) < 0);
  const dedupeBy = (items: Candidate[], key: (c: Candidate) => string) => {
    const seen = new Map<string, Candidate>();
    for (const c of items) {
      const prev = seen.get(key(c));
      if (!prev || better(c, prev)) {
        seen.set(key(c), c);
      }
    }
    return [...seen.values()];
  };

  return dedupeBy(
    dedupeBy(candidates, (c) => c.gameKey),
    (c) => `slug:${c.slug}`
  );
}

function buildPool(candidates: Candidate[], limit: number): Candidate[] {
  const needed = Math.max(RESULT_SIZE, limit);
  const strict = candidates.filter((c) => c.score >= OVERLAP_THRESHOLD);
  if (strict.length >= needed) {
    return strict;
  }

  const fallback = candidates
    .filter((c) => c.score < OVERLAP_THRESHOLD)
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
    .slice(0, Math.max(POOL_SIZE, needed) - strict.length);
  return [...strict, ...fallback];
}

function pickWithRotation(pool: Candidate[], seed: string, limit: number): string[] {
  const chance = new Chance(seed);
  const byDownloads = [...pool].sort(
    (a, b) => b.downloads - a.downloads || a.id.localeCompare(b.id)
  );
  const underdogCount = Math.max(1, Math.floor(byDownloads.length * UNDERDOG_SHARE));
  const popular = chance.shuffle(byDownloads.slice(0, -underdogCount));
  const underdogs = chance.shuffle(byDownloads.slice(-underdogCount));

  const picked = [...popular.slice(0, Math.max(0, limit - 1)), ...underdogs.slice(0, 1)];
  const pickedIds = new Set(picked.map((c) => c.id));
  const rest = chance.shuffle(pool.filter((c) => !pickedIds.has(c.id)));

  return [...picked, ...rest].slice(0, limit).map((c) => c.id);
}

export function getRecommendedGameIds(
  gameId: string,
  limit = RESULT_SIZE,
  hideAiTranslations = false
): string[] {
  if (!gameId) {
    return [];
  }

  const epoch = Math.floor(Date.now() / ROTATION_WINDOW_MS);
  const memoKey = `${gameId}:${limit}:${hideAiTranslations ? 1 : 0}`;
  const cached = memo.get(memoKey);
  if (cached && cached.epoch === epoch) {
    return cached.ids;
  }

  const db = getDatabase();
  const source = db
    .prepare('SELECT slug, steam_app_id, steam_tag_ids FROM games WHERE id = ?')
    .get(gameId) as SourceRow | undefined;
  const sourceTags = parseTags(source?.steam_tag_ids ?? 'null');
  if (sourceTags.size === 0) {
    return [];
  }

  const candidates = loadCandidates(db, gameId, source as SourceRow, hideAiTranslations);
  const pool = buildPool(
    dedupeTranslations(scoreCandidates(candidates, sourceTags)),
    limit
  );
  if (pool.length === 0) {
    return [];
  }

  const ids = pickWithRotation(pool, `${gameId}:${epoch}`, limit);
  memo.set(memoKey, { epoch, ids });
  return ids;
}
