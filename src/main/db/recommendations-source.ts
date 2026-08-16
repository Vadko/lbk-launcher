import Chance from 'chance';
import { getDatabase } from './database';
import { VISIBLE_GAMES_SQL } from './db-queries';

/**
 * Динамічні рекомендації за перетином Steam-тегів (games.steam_tag_ids,
 * синкається з адмінки). Кандидати — без ШІ-міток і не в тех-доробці,
 * 2 популярні + 1 андердог, ротація раз на 3 дні.
 */

// 50%: на реальних тегах медіана 19 кандидатів; при 70% секція зникала б у половини каталогу
const OVERLAP_THRESHOLD = 0.5;
const RESULT_SIZE = 3;
// нижня третина пулу за завантаженнями — кандидати в «андердоги»
const UNDERDOG_SHARE = 1 / 3;

interface CandidateRow {
  id: string;
  slug: string;
  steam_app_id: number | null;
  downloads: number | null;
  steam_tag_ids: string;
}

interface ScoredCandidate {
  id: string;
  gameKey: string;
  downloads: number;
  score: number;
}

// кеш на епоху: стабільність набору між навігаціями і нуль повторних сканів
const memo = new Map<string, { epoch: number; ids: string[] }>();

function parseTags(json: string): number[] {
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed)
      ? parsed.filter((t): t is number => typeof t === 'number')
      : [];
  } catch {
    return [];
  }
}

export function getRecommendedGameIds(gameId: string, limit = RESULT_SIZE): string[] {
  if (!gameId) {
    return [];
  }
  const rotationEpoch = Math.floor(Date.now() / (3 * 24 * 3600 * 1000));
  const cached = memo.get(`${gameId}:${limit}`);
  if (cached && cached.epoch === rotationEpoch) {
    return cached.ids;
  }

  const db = getDatabase();
  const source = db
    .prepare('SELECT slug, steam_app_id, steam_tag_ids FROM games WHERE id = ?')
    .get(gameId) as
    | { slug: string; steam_app_id: number | null; steam_tag_ids: string | null }
    | undefined;

  if (!source?.steam_tag_ids) {
    return [];
  }
  const sourceTags = new Set(parseTags(source.steam_tag_ids));
  if (sourceTags.size === 0) {
    return [];
  }

  // slug/appid відсіюють інші переклади тієї ж гри; подвійний бінд appid,
  // бо `x != NULL` у SQLite — NULL, і джерело без appid втратило б кандидатів
  const rows = db
    .prepare(
      `SELECT id, slug, steam_app_id, downloads, steam_tag_ids
       FROM games
       WHERE ${VISIBLE_GAMES_SQL}
         AND ai IS NULL
         AND status != 'tech-improvement'
         AND id != ?
         AND slug != ?
         AND (? IS NULL OR steam_app_id IS NULL OR steam_app_id != ?)
         AND steam_tag_ids IS NOT NULL`
    )
    .all(gameId, source.slug, source.steam_app_id, source.steam_app_id) as CandidateRow[];

  const scored: ScoredCandidate[] = [];
  for (const row of rows) {
    const tags = new Set(parseTags(row.steam_tag_ids));
    if (tags.size === 0) {
      continue;
    }
    let shared = 0;
    for (const t of tags) {
      if (sourceTags.has(t)) {
        shared++;
      }
    }
    if (shared === 0) {
      continue;
    }
    scored.push({
      id: row.id,
      gameKey: row.steam_app_id != null ? `app:${row.steam_app_id}` : `slug:${row.slug}`,
      downloads: row.downloads ?? 0,
      score: shared / sourceTags.size,
    });
  }

  // переклади-близнюки однієї гри (спільний appid/slug) — лишаємо один,
  // із більшими завантаженнями, інакше в секції будуть дві картки тієї ж гри
  const byGame = new Map<string, ScoredCandidate>();
  for (const c of scored) {
    const seen = byGame.get(c.gameKey);
    if (!seen || c.downloads > seen.downloads) {
      byGame.set(c.gameKey, c);
    }
  }
  const deduped = [...byGame.values()];

  let pool = deduped.filter((c) => c.score >= OVERLAP_THRESHOLD);
  if (pool.length < RESULT_SIZE) {
    // добір найближчими за перетином, щоб секція не зникала; беремо із
    // запасом (до 9), щоб ротації було з чого перемішувати
    const fallback = deduped
      .filter((c) => c.score < OVERLAP_THRESHOLD)
      .sort((a, b) => b.score - a.score);
    pool = [...pool, ...fallback.slice(0, RESULT_SIZE * 3 - pool.length)];
  }
  if (pool.length === 0) {
    return [];
  }

  // сід = гра + 3-денне вікно: набір стабільний три доби, потім ротація
  const chance = new Chance(`${gameId}:${rotationEpoch}`);

  // тай-брейк по id: без нього порядок рівних залежить від порядку рядків у БД
  const byDownloads = [...pool].sort(
    (a, b) => b.downloads - a.downloads || a.id.localeCompare(b.id)
  );
  const underdogCount = Math.max(1, Math.floor(byDownloads.length * UNDERDOG_SHARE));
  const highPool = byDownloads.slice(0, byDownloads.length - underdogCount);
  const lowPool = byDownloads.slice(byDownloads.length - underdogCount);

  // (limit-1) популярних + 1 з мінімальними завантаженнями
  const picked = [
    ...chance.shuffle(highPool).slice(0, Math.max(0, limit - 1)),
    ...chance.shuffle(lowPool).slice(0, 1),
  ];
  if (picked.length < limit) {
    const pickedIds = new Set(picked.map((c) => c.id));
    const rest = chance.shuffle(pool.filter((c) => !pickedIds.has(c.id)));
    picked.push(...rest.slice(0, limit - picked.length));
  }

  const ids = picked.slice(0, limit).map((c) => c.id);
  memo.set(`${gameId}:${limit}`, { epoch: rotationEpoch, ids });
  return ids;
}
