/* eslint-disable no-restricted-syntax -- Cyrillic catalog titles and queries are what the search matches */
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';
import { generateSearchableString, withStrippedVariant } from '../../shared/search-utils';
import { VISIBLE_GAMES_SQL } from './db-queries';
import { buildSearchCondition } from './search-condition';

const CATALOG: { name: string; keywords?: string; hide?: boolean }[] = [
  { name: 'Elden Ring' },
  { name: 'Reigns' },
  { name: 'Hogwarts Legacy' },
  { name: 'Dice Legacy' },
  { name: 'Hollow Knight' },
  { name: 'Hollow Knight: Silksong' },
  { name: 'Stellar Blade' },
  { name: "Assassin's Creed" },
  { name: 'Mario Kart 8' },
  { name: 'Project Zomboid' },
  { name: 'Half-Life' },
  { name: 'Half-Life 2' },
  { name: 'Life is Strange' },
  { name: 'Resident Evil' },
  { name: 'Resident Evil 4' },
  { name: 'Brothers: A Tale of Two Sons Remake' },
  { name: 'Monster Hunter: World' },
  { name: 'Fallout 76' },
  { name: 'Anno 2070' },
  { name: 'Monument Valley' },
  { name: 'METAL GEAR SOLID 3: Snake Eater' },
  { name: 'Відьмак 3: Дикий гін', keywords: 'witcher 3 wild hunt' },
  { name: 'Stardew Valley', hide: true },
];

const spellfixPath = join(
  __dirname,
  '../../../resources/extensions',
  `spellfix.${process.platform === 'darwin' ? 'dylib' : process.platform === 'win32' ? 'dll' : 'so'}`
);

function catalogDb(withSpellfix: boolean): Database.Database {
  const db = new Database(':memory:');
  db.exec(`
    CREATE TABLE games (id TEXT PRIMARY KEY, name TEXT, name_search TEXT, approved INTEGER,
      hide INTEGER, user_unlocked INTEGER DEFAULT 0);
    CREATE VIRTUAL TABLE games_fts USING fts5(game_id UNINDEXED, name_search, search_keywords, tokenize='unicode61');
  `);
  CATALOG.forEach((game, i) => {
    const nameSearch = generateSearchableString(game.name);
    db.prepare('INSERT INTO games VALUES (?, ?, ?, 1, ?, 0)').run(
      String(i),
      game.name,
      nameSearch,
      game.hide ? 1 : 0
    );
    db.prepare('INSERT INTO games_fts VALUES (?, ?, ?)').run(
      String(i),
      nameSearch,
      game.keywords ? withStrippedVariant(game.keywords) : null
    );
  });
  if (withSpellfix) {
    db.loadExtension(spellfixPath.replace(/\.(dylib|so|dll)$/, ''));
    db.exec('CREATE VIRTUAL TABLE spellfix_words USING spellfix1');
    const words = CATALOG.filter((game) => !game.hide).flatMap((game) =>
      game.name.toLowerCase().split(/\s+/)
    );
    for (const word of new Set(words.map((w) => w.replace(/[^a-zа-яіїєґ0-9]/gi, '')))) {
      if (word.length >= 3) {
        db.prepare('INSERT INTO spellfix_words(word) VALUES (?)').run(word);
      }
    }
  }
  return db;
}

function search(db: Database.Database, query: string, typoFallback: boolean): string[] {
  const condition = buildSearchCondition(db, query, typoFallback);
  return (
    db
      .prepare(
        `SELECT name FROM games WHERE ${VISIBLE_GAMES_SQL}${condition ? ` AND ${condition.sql}` : ''} ORDER BY name`
      )
      .all(...(condition?.params ?? [])) as { name: string }[]
  ).map((row) => row.name);
}

describe('buildSearchCondition', () => {
  const db = catalogDb(false);

  it('has no condition for a blank query', () => {
    expect(buildSearchCondition(db, '   ', false)).toBeNull();
  });

  it.each([
    ['a lowercase Cyrillic letter', 'в', ['Відьмак 3: Дикий гін']],
    ['a number that narrows the series', 'resident evil 4', ['Resident Evil 4']],
    ['a number missing from the catalog', 'fallout 4', ['Fallout 76']],
    ['a number in keywords', 'witcher 3', ['Відьмак 3: Дикий гін']],
    ['a number with no real word', 'S.T.A.L.K.E.R. 2', []],
  ])('%s: %s', (_, query, expected) => {
    expect(search(db, query, false)).toEqual(expected);
  });
});

describe.runIf(existsSync(spellfixPath))('buildSearchCondition typo fallback', () => {
  const db = catalogDb(true);

  it.each([
    ['a missing letter', 'hollw', ['Hollow Knight', 'Hollow Knight: Silksong']],
    ['a Cyrillic spelling', 'резидент евіл', ['Resident Evil', 'Resident Evil 4']],
    ['a candidate past the closest one', 'elden rign', ['Elden Ring']],
    ['a typo beside a known word', 'hogwrts legacy', ['Hogwarts Legacy']],
    ['two typos that must fit each other', 'ассасін крід', ["Assassin's Creed"]],
    ['the same, in reverse', 'крід ассасін', ["Assassin's Creed"]],
    ['a typo in the 2nd letter', 'poject zomboid', ['Project Zomboid']],
    ['a known word left as typed', 'half lfe', ['Half-Life', 'Half-Life 2']],
    ['one word too many', 'resident evil 4 remake', ['Resident Evil', 'Resident Evil 4']],
    ['one word too many, by keywords', 'witcher 3 wild hnt', ['Відьмак 3: Дикий гін']],
    ['a near title', 'monster hunter wilds', ['Monster Hunter: World']],
    ['the Ukrainian keyboard layout', 'удвут кштп', ['Elden Ring']],
    ['the English keyboard layout', 'Dslmvfr', ['Відьмак 3: Дикий гін']],
    ['a far word', 'stalker', []],
    ['a missing game sharing a word', 'The Outer Worlds', []],
    ['a missing game with a typo', 'stardw valley', []],
    ['a hidden game', 'Stardew Valley', []],
    ['an unknown number', 'Cyberpunk 2077', []],
    ['a number alone', '2077', []],
    ['emoji', '😀😀😀', []],
  ])('%s: %s', (_, query, expected) => {
    expect(search(db, query, true)).toEqual(expected);
  });
});
