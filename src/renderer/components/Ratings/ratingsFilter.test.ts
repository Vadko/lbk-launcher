import { describe, expect, it } from 'vitest';
import { findMatch, rankedRows, suggest } from './ratingsFilter';

const names = ['Solomon Team', 'Console UA', 'Solo Level', 'Persona Solo', 'Stalker'];
const self = (name: string) => name;

describe('findMatch', () => {
  it('finds the query anywhere in the name, ignoring case', () => {
    expect(findMatch('Console UA', 'SOL')).toEqual({ start: 3, end: 6 });
  });

  it('finds a query typed with the other keyboard layout', () => {
    // eslint-disable-next-line no-restricted-syntax -- the subject is a query typed with the Cyrillic layout on
    expect(findMatch('Solo Level', 'ыщдщ')).toEqual({ start: 0, end: 4 });
  });

  it('matches nothing for a blank query', () => {
    expect(findMatch('Solo Level', '  ')).toBeNull();
  });
});

describe('suggest', () => {
  it('puts names with a word starting with the query first, keeping rating order', () => {
    expect(suggest(names, self, 'sol').map((s) => s.item)).toEqual([
      'Solomon Team',
      'Solo Level',
      'Persona Solo',
      'Console UA',
    ]);
  });

  it('offers at most four names', () => {
    expect(suggest(names, self, 'o')).toHaveLength(4);
  });
});

describe('rankedRows', () => {
  it('keeps the rating rank of every filtered row', () => {
    expect(rankedRows(names, { kind: 'query', text: 'solo' }, self, self)).toEqual([
      { item: 'Solomon Team', rank: 1 },
      { item: 'Solo Level', rank: 3 },
      { item: 'Persona Solo', rank: 4 },
    ]);
  });

  it('leaves only the picked row', () => {
    expect(
      rankedRows(names, { kind: 'item', key: 'Stalker', name: 'Stalker' }, self, self)
    ).toEqual([{ item: 'Stalker', rank: 5 }]);
  });

  it('keeps every row without a filter', () => {
    expect(rankedRows(names, null, self, self)).toHaveLength(5);
  });
});
