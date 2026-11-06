import { A, G, O, pipe } from '@mobily/ts-belt';
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
): readonly Suggestion<T>[] {
  return pipe(
    items,
    A.filterMap((item) =>
      O.map(O.fromNullable(findMatch(getName(item), query)), (match) => ({ item, match }))
    ),
    A.partition(({ item, match }) => startsWord(getName(item), match.start)),
    ([atWord, inside]) => A.concat(atWord, inside),
    A.take(SUGGESTION_LIMIT)
  );
}

// A filtered row keeps its place in the whole rating
export function rankedRows<T>(
  items: readonly T[],
  filter: RatingsFilter | null,
  getKey: (item: T) => string,
  getName: (item: T) => string
): readonly RankedRow<T>[] {
  const keeps = (item: T) =>
    G.isNullable(filter) ||
    (filter.kind === 'item'
      ? getKey(item) === filter.key
      : G.isNotNullable(findMatch(getName(item), filter.text)));
  return pipe(
    items,
    A.mapWithIndex((index, item) => ({ item, rank: index + 1 })),
    A.filter(({ item }) => keeps(item))
  );
}
