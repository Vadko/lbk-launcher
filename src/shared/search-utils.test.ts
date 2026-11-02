/* eslint-disable no-restricted-syntax -- transliterated query forms are Cyrillic */
import { describe, expect, it } from 'vitest';
import { buildFtsQueries } from './search-utils';

describe('buildFtsQueries', () => {
  it.each([
    [
      'resident evil 4',
      [
        '("resident"* AND "evil"* AND "4"*) OR ("ресідент"* AND "евіл"* AND "4"*)',
        '("resident"* AND "evil"*) OR ("ресідент"* AND "евіл"*)',
      ],
    ],
    ['portal', ['("portal"*) OR ("портал"*)']],
    ['2077', ['("2077"*)']],
    ['S.T.A.L.K.E.R. 2', []],
    ['x 2', []],
  ])('%s', (input, expected) => {
    expect(buildFtsQueries(input)).toEqual(expected);
  });
});
