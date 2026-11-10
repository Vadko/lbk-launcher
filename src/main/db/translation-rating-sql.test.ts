import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';
import { translationRating } from '@/shared/translation-rating';
import {
  MANUAL_FIRST_SQL,
  registerTranslationRating,
  TRANSLATION_RATING_SQL,
} from './translation-rating-sql';

interface Row {
  id: string;
  likes: number;
  downloads: number | null;
  reviews: number;
  ai: string | null;
}

const ROWS: Row[] = [
  { id: 'raw-ai-hit', likes: 400, downloads: 9000, reviews: 40, ai: 'non-edited' },
  { id: 'manual-new', likes: 0, downloads: null, reviews: 0, ai: null },
  { id: 'edited', likes: 20, downloads: 300, reviews: 3, ai: 'edited' },
  { id: 'manual-hit', likes: 120, downloads: 1500, reviews: 12, ai: null },
];

function gamesDb() {
  const db = new Database(':memory:');
  registerTranslationRating(db);
  db.exec(
    'CREATE TABLE games (id TEXT, likes INTEGER, downloads INTEGER, reviews INTEGER, ai TEXT)'
  );
  const insert = db.prepare(
    'INSERT INTO games VALUES (@id, @likes, @downloads, @reviews, @ai)'
  );
  for (const row of ROWS) {
    insert.run(row);
  }
  return db;
}

describe('translation_rating()', () => {
  const db = gamesDb();

  it.each(ROWS)('$id rates as translationRating() does', (row) => {
    const { rating } = db
      .prepare<[string], { rating: number }>(
        `SELECT ${TRANSLATION_RATING_SQL} AS rating FROM games WHERE id = ?`
      )
      .get(row.id) as { rating: number };
    expect(rating).toBe(translationRating(row));
  });

  it('ranks manual translations first, each kind by rating', () => {
    const ids = db
      .prepare<[], { id: string }>(
        `SELECT id FROM games ORDER BY ${MANUAL_FIRST_SQL}, ${TRANSLATION_RATING_SQL} DESC`
      )
      .all()
      .map((row) => row.id);
    expect(ids).toEqual(['manual-hit', 'manual-new', 'raw-ai-hit', 'edited']);
  });
});
