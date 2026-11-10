import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';
import { TRANSLATION_RANK_SQL, TRANSLATION_RATING_SQL } from './translation-rating-sql';

interface Row {
  likes: number | null;
  downloads: number | null;
  reviews: number | null;
  ai: string | null;
  translation_progress: number;
}

const row = (overrides: Partial<Row>): Row => ({
  likes: 0,
  downloads: 0,
  reviews: 0,
  ai: null,
  translation_progress: 100,
  ...overrides,
});

function gamesDb(rows: Record<string, Row>) {
  const db = new Database(':memory:');
  db.exec(
    'CREATE TABLE games (id TEXT, likes INTEGER, downloads INTEGER, reviews INTEGER, ai TEXT, translation_progress INTEGER)'
  );
  const insert = db.prepare(
    'INSERT INTO games VALUES (@id, @likes, @downloads, @reviews, @ai, @translation_progress)'
  );
  for (const [id, values] of Object.entries(rows)) {
    insert.run({ id, ...values });
  }
  return db;
}

describe('TRANSLATION_RATING_SQL', () => {
  it.each([
    ['manual, no counters', row({}), 0.045 + 0.25],
    [
      'null counters as 0',
      row({ likes: null, downloads: null, reviews: null }),
      0.045 + 0.25,
    ],
    ['AI with human editing', row({ ai: 'edited' }), 0.045 + 0.2],
    ['raw AI', row({ ai: 'non-edited' }), 0.045 + 0.1375],
    ['an unknown ai value as raw AI', row({ ai: 'future' }), 0.045 + 0.1375],
    [
      'negative counters as 0',
      row({ likes: -3, downloads: -5, reviews: -1 }),
      0.045 + 0.25,
    ],
    [
      'every term',
      row({ likes: 93, downloads: 999, reviews: 9 }),
      (0.45 * 100) / 1069 + 0.25 + 0.2 * 3 + 0.1 * 1,
    ],
  ])('%s', (_label, values, expected) => {
    const { rating } = gamesDb({ game: values })
      .prepare<[], { rating: number }>(
        `SELECT ${TRANSLATION_RATING_SQL} AS rating FROM games`
      )
      .get() as { rating: number };
    expect(rating).toBeCloseTo(expected, 10);
  });
});

describe('TRANSLATION_RANK_SQL', () => {
  it.each([
    [
      'a manual translation before a better rated AI one',
      row({ downloads: 5 }),
      row({ ai: 'edited', downloads: 5000, likes: 900 }),
    ],
    [
      'the better rated of two manual translations first',
      row({ downloads: 500, likes: 60 }),
      row({ downloads: 100, likes: 2 }),
    ],
    [
      'the better rated of two AI translations first, edited or not',
      row({ ai: 'non-edited', downloads: 3000, likes: 300 }),
      row({ ai: 'edited', downloads: 10 }),
    ],
    [
      'the more complete one on an equal rating',
      row({ translation_progress: 90 }),
      row({ translation_progress: 40 }),
    ],
  ])('%s', (_label, first, second) => {
    const ids = gamesDb({ second, first })
      .prepare<[], { id: string }>(
        `SELECT id FROM games ORDER BY ${TRANSLATION_RANK_SQL}`
      )
      .all()
      .map((game) => game.id);
    expect(ids).toEqual(['first', 'second']);
  });
});
