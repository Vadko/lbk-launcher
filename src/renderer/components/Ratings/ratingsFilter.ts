import { A } from '@mobily/ts-belt';
import { switchLayout } from '@/shared/search-utils';

export type RatingsFilter =
  | { kind: 'query'; text: string }
  | { kind: 'item'; key: string; name: string };

export interface NameMatch {
  start: number;
  end: number;
}

export interface Suggestion<T> {
  item: T;
  match: NameMatch;
}

export interface RankedRow<T> {
  item: T;
  rank: number;
}

const SUGGESTION_LIMIT = 4;

const locate = (name: string, query: string): NameMatch | null => {
  const start = name.toLocaleLowerCase('uk').indexOf(query.toLocaleLowerCase('uk'));
  return start < 0 ? null : { start, end: start + query.length };
};

// The query as typed with the other layout on still finds the name: "cjkj" is "соло"
export function findMatch(name: string, query: string): NameMatch | null {
  const trimmed = query.trim();
  if (!trimmed) {
    return null;
  }
  const switched = switchLayout(trimmed);
  return locate(name, trimmed) ?? (switched ? locate(name, switched) : null);
}

const startsWord = (name: string, start: number) =>
  start === 0 || /[^\p{L}\p{N}]/u.test(name[start - 1]);

// Names a word of which starts with the query go first, each group in rating order
export function suggest<T>(
  items: readonly T[],
  getName: (item: T) => string,
  query: string
): Suggestion<T>[] {
  const found = items.flatMap((item) => {
    const match = findMatch(getName(item), query);
    return match ? [{ item, match }] : [];
  });
  const [atWord, inside] = A.partition(found, ({ item, match }) =>
    startsWord(getName(item), match.start)
  );
  return [...atWord, ...inside].slice(0, SUGGESTION_LIMIT);
}

// A filtered row keeps its place in the whole rating
export function rankedRows<T>(
  items: readonly T[],
  filter: RatingsFilter | null,
  getKey: (item: T) => string,
  getName: (item: T) => string
): RankedRow<T>[] {
  const rows = items.map((item, index) => ({ item, rank: index + 1 }));
  if (!filter) {
    return rows;
  }
  return rows.filter(({ item }) =>
    filter.kind === 'item'
      ? getKey(item) === filter.key
      : findMatch(getName(item), filter.text) !== null
  );
}
