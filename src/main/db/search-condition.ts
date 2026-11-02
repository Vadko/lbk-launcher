import { A, pipe } from '@mobily/ts-belt';
import type Database from 'better-sqlite3';
import {
  buildFtsQueries,
  stripApostrophes,
  switchLayout,
} from '../../shared/search-utils';
import { VISIBLE_GAMES_SQL } from './db-queries';

export interface SearchCondition {
  sql: string;
  params: string[];
}

const FTS_MATCH_SQL = 'id IN (SELECT game_id FROM games_fts WHERE games_fts MATCH ?)';

// One missing letter costs exactly 100 in spellfix's edit distance; anything further is another word
const SPELLFIX_CANDIDATES_SQL =
  'SELECT word FROM spellfix_words WHERE word MATCH ? AND top = 5 AND scope = ? AND distance <= 100 ORDER BY score';

// Scope 2 alone offers nothing for a typo in the 2nd letter ("poject"), so scope 1 follows it
const SPELLFIX_SCOPES = [2, 1];

function ftsMatch(query: string): SearchCondition {
  return { sql: FTS_MATCH_SQL, params: [query] };
}

export function hasVisibleMatch(
  db: Database.Database,
  condition: SearchCondition
): boolean {
  return (
    db
      .prepare(
        `SELECT 1 FROM games WHERE ${VISIBLE_GAMES_SQL} AND ${condition.sql} LIMIT 1`
      )
      .get(...condition.params) !== undefined
  );
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
    return { sql: 'name_search LIKE ?', params: [`${query.toLowerCase()}%`] };
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
  const correctedFts = typoFallback ? correctFtsQuery(db, query) : null;
  return correctedFts ? ftsMatch(correctedFts) : conditions[0];
}

function queryConditions(
  query: string,
  options?: { transliterate: boolean }
): SearchCondition[] {
  const ftsQueries = buildFtsQueries(query, options);
  return ftsQueries.length
    ? ftsQueries.map(ftsMatch)
    : [{ sql: 'name LIKE ?', params: [`%${query}%`] }];
}

function prefixTerm(word: string): string {
  return `"${word}"*`;
}

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

// The first candidate that finds a game together with the other terms, so "elden rign" picks "ring"
function correctWord(
  db: Database.Database,
  word: string,
  context: readonly string[]
): string {
  const candidates = A.map(correctionCandidates(db, word), prefixTerm);
  const fits = (term: string) =>
    hasVisibleMatch(db, ftsMatch([...context, term].join(' AND ')));
  return A.find(candidates, fits) ?? A.head(candidates) ?? prefixTerm(word);
}

function correctFtsQuery(db: Database.Database, searchQuery: string): string | null {
  // The spellfix dictionary has no apostrophes (extractUniqueWords), so strip the query too
  const words = stripApostrophes(searchQuery)
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((w) => w.length >= 3);

  if (words.length === 0) {
    return null;
  }

  try {
    const [knownWords, unknownWords] = A.partition(
      words,
      (word) => /^\p{N}+$/u.test(word) || hasVisibleMatch(db, ftsMatch(prefixTerm(word)))
    );
    const knownTerms = A.map(knownWords, prefixTerm);
    // Corrected words must fit each other too, or "ассасін крід" pairs assassin with kart
    const firstPass = A.reduce(
      unknownWords,
      [] as readonly string[],
      (corrected, word) => [
        ...corrected,
        correctWord(db, word, [...knownTerms, ...corrected]),
      ]
    );
    // An early pick never saw the words after it, so each is picked again against all the others
    const corrected = A.reduceWithIndex(unknownWords, firstPass, (terms, word, i) =>
      A.replaceAt(
        terms,
        i,
        correctWord(db, word, [...knownTerms, ...A.removeAt(terms, i)])
      )
    );

    const terms = [...knownTerms, ...corrected];
    const allTerms = terms.join(' AND ');
    if (terms.length < 3 || hasVisibleMatch(db, ftsMatch(allTerms))) {
      return allTerms;
    }
    // One word too many in a longer title: "hollow knigt game", "resident evil 4 remake"
    return pipe(
      terms,
      A.mapWithIndex((i) => `(${A.removeAt(terms, i).join(' AND ')})`),
      A.join(' OR ')
    );
  } catch (e) {
    console.warn('[GamesRepository] Spellfix fuzzy fallback error:', e);
    return null;
  }
}
