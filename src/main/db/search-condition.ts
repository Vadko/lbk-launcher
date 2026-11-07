import { A, pipe } from '@mobily/ts-belt';
import type Database from 'better-sqlite3';
import {
  APOSTROPHES,
  buildFtsQueries,
  queryForms,
  stripApostrophes,
  switchLayout,
} from '../../shared/search-utils';
import { VISIBLE_GAMES_SQL } from './db-queries';

export interface SearchCondition {
  sql: string;
  params: string[];
  // The query in the forms the match read it (typed, other layout, transliterated, corrected), to rank titles starting with one
  prefixes: string[];
}

type SqlPredicate = Pick<SearchCondition, 'sql' | 'params'>;

const FTS_MATCH_SQL = 'id IN (SELECT game_id FROM games_fts WHERE games_fts MATCH ?)';

// One missing letter costs exactly 100 in spellfix's edit distance; anything further is another word
const SPELLFIX_CANDIDATES_SQL =
  'SELECT word FROM spellfix_words WHERE word MATCH ? AND top = 5 AND scope = ? AND distance <= 100 ORDER BY score';

// Scope 2 alone offers nothing for a typo in the 2nd letter ("poject"), so scope 1 follows it
const SPELLFIX_SCOPES = [2, 1];

const WORD = /[\p{L}\p{N}]+/gu;

// name_search starts with the lowercased name, here without apostrophes the way stripApostrophes() drops them
const STRIPPED_NAME_SEARCH_SQL = [...APOSTROPHES].reduce(
  (sql, char) => `replace(${sql}, '${char.replaceAll("'", "''")}', '')`,
  'name_search'
);

const escapeLike = (value: string) => value.replace(/[\\%_]/g, '\\$&');

const prefixForms = (forms: readonly string[]): string[] => [
  ...new Set(
    forms
      .map((form) => stripApostrophes(form).toLowerCase().replace(/\s+/g, ' ').trim())
      .filter(Boolean)
  ),
];

function ftsMatch(query: string): SqlPredicate {
  return { sql: FTS_MATCH_SQL, params: [query] };
}

export function hasVisibleMatch(db: Database.Database, condition: SqlPredicate): boolean {
  return (
    db
      .prepare(
        `SELECT 1 FROM games WHERE ${VISIBLE_GAMES_SQL} AND ${condition.sql} LIMIT 1`
      )
      .get(...condition.params) !== undefined
  );
}

// Titles that start with the query come first: "The Room" before "Silent Hill 4: The Room"
export function prefixFirstOrder(condition: SearchCondition | null): SqlPredicate | null {
  if (!condition?.prefixes.length) {
    return null;
  }
  return {
    sql: `EXISTS (SELECT 1 FROM json_each(?) WHERE substr(${STRIPPED_NAME_SEARCH_SQL}, 1, length(json_each.value)) = json_each.value) DESC`,
    params: [JSON.stringify(condition.prefixes)],
  };
}

// One search predicate for every list and the facet counts, so a count never disagrees with its list
export function buildSearchCondition(
  db: Database.Database,
  searchQuery: string | undefined,
  typoFallback: boolean
): SearchCondition | null {
  const query = searchQuery?.trim();
  if (!query) {
    return null;
  }

  // An FTS prefix scan is expensive for 1 char; SQLite's LIKE folds ASCII only, and name_search is lowercased in JS
  if (query.length === 1) {
    return {
      sql: "name_search LIKE ? ESCAPE '\\'",
      params: [`${escapeLike(query.toLowerCase())}%`],
      prefixes: prefixForms([query]),
    };
  }

  const conditions = queryConditions(query);
  const switched = switchLayout(query);
  // The other keyboard layout ("цфк" for war) only once nothing is found as typed, and never transliterated again ("tym" → "ень" → "en")
  const fallbacks = switched ? queryConditions(switched, { transliterate: false }) : [];
  const match = [...conditions, ...fallbacks].find((condition) =>
    hasVisibleMatch(db, condition)
  );
  if (match) {
    return match;
  }

  // Typo fallback is decided on the search alone, so the other filters still apply to its matches
  const corrected = typoFallback ? correctFtsQuery(db, query) : null;
  return corrected
    ? { ...ftsMatch(corrected.fts), prefixes: prefixForms(corrected.prefixes) }
    : conditions[0];
}

function queryConditions(
  query: string,
  options?: { transliterate: boolean }
): SearchCondition[] {
  const prefixes = prefixForms(queryForms(query, options));
  const ftsQueries = buildFtsQueries(query, options);
  return ftsQueries.length
    ? ftsQueries.map((fts) => ({ ...ftsMatch(fts), prefixes }))
    : [{ sql: "name LIKE ? ESCAPE '\\'", params: [`%${escapeLike(query)}%`], prefixes }];
}

function prefixTerm(word: string): string {
  return `"${word}"*`;
}

const allOf = (words: readonly string[]) => A.map(words, prefixTerm).join(' AND ');

function adjacentSwaps(word: string): readonly string[] {
  const chars = [...word];
  return pipe(
    A.makeWithIndex(chars.length - 1, (i) =>
      [...chars.slice(0, i), chars[i + 1], chars[i], ...chars.slice(i + 2)].join('')
    ),
    A.reject((swap) => swap === word)
  );
}

// Close dictionary words first; spellfix's edit distance has no transposition ("rign" is 200 from "ring")
function correctionCandidates(db: Database.Database, word: string): readonly string[] {
  const spellfixWords = pipe(
    SPELLFIX_SCOPES,
    A.map(
      (scope) =>
        db.prepare(SPELLFIX_CANDIDATES_SQL).all(word, scope) as { word: string }[]
    ),
    A.flat,
    A.map((row) => row.word)
  );
  const swapped = A.filter(adjacentSwaps(word), (swap) =>
    hasVisibleMatch(db, ftsMatch(`"${swap}"`))
  );
  return A.uniq([...spellfixWords, ...swapped]);
}

// The first candidate that finds a game together with the other words, so "elden rign" picks "ring"
function correctWord(
  db: Database.Database,
  word: string,
  context: readonly string[]
): string {
  const candidates = correctionCandidates(db, word);
  const fits = (candidate: string) =>
    hasVisibleMatch(db, ftsMatch(allOf([...context, candidate])));
  return A.find(candidates, fits) ?? A.head(candidates) ?? word;
}

function correctFtsQuery(
  db: Database.Database,
  searchQuery: string
): { fts: string; prefixes: string[] } | null {
  // The spellfix dictionary has no apostrophes (extractUniqueWords), so strip the query too
  const text = stripApostrophes(searchQuery).toLowerCase();
  const words = text.split(/[^\p{L}\p{N}]+/u).filter((w) => w.length >= 3);

  if (words.length === 0) {
    return null;
  }

  try {
    const [knownWords, unknownWords] = A.partition(
      words,
      (word) => /^\p{N}+$/u.test(word) || hasVisibleMatch(db, ftsMatch(prefixTerm(word)))
    );
    // Corrected words must fit each other too, or "ассасін крід" pairs assassin with kart
    const firstPass = A.reduce(
      unknownWords,
      [] as readonly string[],
      (corrected, word) => [
        ...corrected,
        correctWord(db, word, [...knownWords, ...corrected]),
      ]
    );
    // An early pick never saw the words after it, so each is picked again against all the others
    const corrected = A.reduceWithIndex(unknownWords, firstPass, (picked, word, i) =>
      A.replaceAt(
        picked,
        i,
        correctWord(db, word, [...knownWords, ...A.removeAt(picked, i)])
      )
    );

    const corrections = new Map(A.zip(unknownWords, corrected));
    // The query as typed with each typo corrected, and without the word a looser match leaves out
    const spelled = (left?: string) =>
      text.replace(WORD, (word) =>
        word === left ? '' : (corrections.get(word) ?? word)
      );
    const terms = [...knownWords, ...corrected];
    const allTerms = allOf(terms);
    if (terms.length < 3 || hasVisibleMatch(db, ftsMatch(allTerms))) {
      return { fts: allTerms, prefixes: [spelled()] };
    }
    // One word too many in a longer title: "hollow knigt game", "resident evil 4 remake"
    return {
      fts: pipe(
        terms,
        A.mapWithIndex((i) => `(${allOf(A.removeAt(terms, i))})`),
        A.join(' OR ')
      ),
      prefixes: words.map((word) => spelled(word)),
    };
  } catch (e) {
    console.warn('[GamesRepository] Spellfix fuzzy fallback error:', e);
    return null;
  }
}
