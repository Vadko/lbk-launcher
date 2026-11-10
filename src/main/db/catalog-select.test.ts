import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';
import { catalogSelectSql } from './catalog-select';

interface Row {
  id: string;
  name: string;
  steam_app_id: number | null;
  slug: string | null;
  ai: string | null;
  downloads: number;
}

const ROWS: Row[] = [
  {
    id: 'alpha-ai',
    name: 'Alpha',
    steam_app_id: 10,
    slug: 'alpha',
    ai: 'edited',
    downloads: 900,
  },
  { id: 'beta', name: 'Beta', steam_app_id: null, slug: 'beta', ai: null, downloads: 5 },
  {
    id: 'alpha-manual',
    name: 'Alpha (no voice)',
    steam_app_id: 10,
    slug: 'alpha-nv',
    ai: null,
    downloads: 1,
  },
  { id: 'gamma', name: 'Gamma', steam_app_id: null, slug: '', ai: null, downloads: 50 },
  {
    id: 'beta-ai',
    name: 'Beta',
    steam_app_id: null,
    slug: 'beta',
    ai: 'non-edited',
    downloads: 3000,
  },
  { id: 'delta', name: 'Delta', steam_app_id: null, slug: '', ai: null, downloads: 20 },
];

const db = new Database(':memory:');
db.exec(
  `CREATE TABLE games (id TEXT, name TEXT, steam_app_id INTEGER, slug TEXT, ai TEXT,
    likes INTEGER DEFAULT 0, downloads INTEGER, reviews INTEGER DEFAULT 0, translation_progress INTEGER DEFAULT 100)`
);
const insert = db.prepare(
  'INSERT INTO games (id, name, steam_app_id, slug, ai, downloads) VALUES (@id, @name, @steam_app_id, @slug, @ai, @downloads)'
);
for (const row of ROWS) {
  insert.run(row);
}

const ids = (sql: string, ...params: (string | number)[]) =>
  db
    .prepare<(string | number)[], { id: string }>(sql)
    .all(...params)
    .map((row) => row.id);

describe('catalogSelectSql', () => {
  it.each([
    [
      'groups by app id, then slug, best translation first',
      { where: '1', order: 'name' },
      [],
      ['alpha-manual', 'alpha-ai', 'beta', 'beta-ai', 'delta', 'gamma'],
    ],
    [
      'places a group where its first translation falls in the order',
      { where: '1', order: 'downloads DESC' },
      [],
      ['beta', 'beta-ai', 'alpha-manual', 'alpha-ai', 'gamma', 'delta'],
    ],
    [
      'binds the where params before the order ones',
      { where: 'downloads < ?', order: 'id = ? DESC, name' },
      [1000, 'gamma'],
      ['gamma', 'alpha-manual', 'alpha-ai', 'beta', 'delta'],
    ],
    [
      'limits the grouped list',
      { where: '1', order: 'name', limited: true },
      [3],
      ['alpha-manual', 'alpha-ai', 'beta'],
    ],
    [
      'keeps the order alone when not grouped',
      { where: '1', order: 'downloads DESC', grouped: false },
      [],
      ['beta-ai', 'alpha-ai', 'gamma', 'delta', 'beta', 'alpha-manual'],
    ],
  ])('%s', (_label, select, params, expected) => {
    expect(ids(catalogSelectSql(select), ...params)).toEqual(expected);
  });

  it('returns only the games columns', () => {
    const row = db
      .prepare(catalogSelectSql({ where: '1', order: 'name' }))
      .get() as object;
    expect(Object.keys(row)).toEqual([
      'id',
      'name',
      'steam_app_id',
      'slug',
      'ai',
      'likes',
      'downloads',
      'reviews',
      'translation_progress',
    ]);
  });
});
