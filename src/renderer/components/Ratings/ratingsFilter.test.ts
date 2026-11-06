import { describe, expect, it } from 'vitest';
import { findMatch, rankedRows, suggest } from './ratingsFilter';

const names = [
  'Northwind Crew',
  'Signora',
  'Northern Lights',
  'Far North',
  'Kettle',
  'Ember Hollow',
];
const self = (name: string) => name;

describe('findMatch', () => {
  it('finds the query anywhere in the name, ignoring case', () => {
    expect(findMatch('Signora', 'NOR')).toEqual({ start: 3, end: 6 });
  });

  it('finds a query typed with the other keyboard layout', () => {
    // eslint-disable-next-line no-restricted-syntax -- the subject is a query typed with the Cyrillic layout on
    expect(findMatch('Ember Hollow', 'рщдд')).toEqual({ start: 6, end: 10 });
  });

  it('matches nothing for a blank query', () => {
    expect(findMatch('Kettle', '  ')).toBeNull();
  });
});

describe('suggest', () => {
  it('puts names with a word starting with the query first, keeping rating order', () => {
    expect(suggest(names, self, 'nor').map((s) => s.item)).toEqual([
      'Northwind Crew',
      'Northern Lights',
      'Far North',
      'Signora',
    ]);
  });

  it('offers at most four names', () => {
    expect(suggest(names, self, 'o')).toHaveLength(4);
  });
});

describe('rankedRows', () => {
  it('keeps the rating rank of every filtered row', () => {
    expect(rankedRows(names, { kind: 'query', text: 'north' }, self, self)).toEqual([
      { item: 'Northwind Crew', rank: 1 },
      { item: 'Northern Lights', rank: 3 },
      { item: 'Far North', rank: 4 },
    ]);
  });

  it('leaves only the picked row', () => {
    expect(
      rankedRows(names, { kind: 'item', key: 'Kettle', name: 'Kettle' }, self, self)
    ).toEqual([{ item: 'Kettle', rank: 5 }]);
  });

  it('keeps every row without a filter', () => {
    expect(rankedRows(names, null, self, self)).toHaveLength(6);
  });
});
