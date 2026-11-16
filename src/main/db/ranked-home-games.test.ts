import Database from 'better-sqlite3';
import { beforeEach, describe, expect, it, vi } from 'vitest';

interface Row {
  id: string;
  downloads: number;
  downloads_30d?: number;
  ai?: string | null;
  status?: string;
  hide?: number;
  daysAgo?: number;
}

const db = new Database(':memory:');
db.exec(
  `CREATE TABLE games (id TEXT, approved INTEGER DEFAULT 1, hide INTEGER DEFAULT 0,
    user_unlocked INTEGER DEFAULT 0, ai TEXT, status TEXT DEFAULT 'completed',
    downloads INTEGER, downloads_30d INTEGER DEFAULT 0, created_at TEXT,
    platforms TEXT DEFAULT '[]', install_paths TEXT, screenshots TEXT, steam_tag_ids TEXT)`
);

vi.mock('@/main/db/database', () => ({ getDatabase: () => db }));

const { getNewStarGames, getPopularGames } = await import('./ranked-home-games');

function seed(rows: Row[]) {
  const insert = db.prepare(
    `INSERT INTO games (id, downloads, downloads_30d, ai, status, hide, created_at)
     VALUES (@id, @downloads, @downloads_30d, @ai, @status, @hide,
       strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-' || @daysAgo || ' days'))`
  );
  for (const row of rows) {
    insert.run({
      downloads_30d: 0,
      ai: null,
      status: 'completed',
      hide: 0,
      daysAgo: 400,
      ...row,
    });
  }
}

const ids = (games: { id: string }[]) => games.map((game) => game.id);

beforeEach(() => {
  db.exec('DELETE FROM games');
});

describe('getPopularGames', () => {
  it.each<[string, Row[], boolean, string[]]>([
    [
      'orders by the downloads of the last 30 days, not the total',
      [
        { id: 'old-hit', downloads: 3500, downloads_30d: 52 },
        { id: 'trending', downloads: 1100, downloads_30d: 190 },
        { id: 'top', downloads: 8100, downloads_30d: 513 },
      ],
      false,
      ['top', 'trending', 'old-hit'],
    ],
    [
      'breaks a tie by the total',
      [
        { id: 'smaller', downloads: 600, downloads_30d: 50 },
        { id: 'bigger', downloads: 900, downloads_30d: 50 },
      ],
      false,
      ['bigger', 'smaller'],
    ],
    [
      'leaves out a translation under 70 downloads in total',
      [
        { id: 'popular', downloads: 70, downloads_30d: 10 },
        { id: 'new', downloads: 69, downloads_30d: 69 },
      ],
      false,
      ['popular'],
    ],
    [
      'leaves out a hidden translation',
      [
        { id: 'shown', downloads: 100, downloads_30d: 1 },
        { id: 'hidden', downloads: 900, downloads_30d: 90, hide: 1 },
      ],
      false,
      ['shown'],
    ],
    [
      'leaves out an AI translation when AI is hidden',
      [
        { id: 'manual', downloads: 100, downloads_30d: 1 },
        { id: 'ai', downloads: 900, downloads_30d: 90, ai: 'edited' },
      ],
      true,
      ['manual'],
    ],
  ])('%s', (_case, rows, hideAi, expected) => {
    seed(rows);

    expect(ids(getPopularGames(hideAi))).toEqual(expected);
  });
});

describe('getNewStarGames', () => {
  it.each<[string, Row[], string[]]>([
    [
      'orders by downloads',
      [
        { id: 'quiet', downloads: 3, daysAgo: 1 },
        { id: 'star', downloads: 40, daysAgo: 10 },
      ],
      ['star', 'quiet'],
    ],
    [
      'puts the newer translation first on a tie',
      [
        { id: 'older', downloads: 5, daysAgo: 10 },
        { id: 'newer', downloads: 5, daysAgo: 2 },
      ],
      ['newer', 'older'],
    ],
    [
      'leaves out a translation older than 21 days',
      [
        { id: 'new', downloads: 5, daysAgo: 20 },
        { id: 'old', downloads: 50, daysAgo: 22 },
      ],
      ['new'],
    ],
    [
      'leaves out a translation with 70 downloads',
      [
        { id: 'star', downloads: 69, daysAgo: 2 },
        { id: 'popular', downloads: 70, daysAgo: 2 },
      ],
      ['star'],
    ],
    [
      'leaves out a planned translation',
      [
        { id: 'released', downloads: 0, daysAgo: 2 },
        { id: 'planned', downloads: 0, daysAgo: 2, status: 'planned' },
      ],
      ['released'],
    ],
  ])('%s', (_case, rows, expected) => {
    seed(rows);

    expect(ids(getNewStarGames(false))).toEqual(expected);
  });
});
