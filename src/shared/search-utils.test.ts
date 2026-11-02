/* eslint-disable no-restricted-syntax -- transliterated and keyboard-layout query forms are Cyrillic */
import { describe, expect, it } from 'vitest';
import { buildFtsQueries, switchLayout } from './search-utils';

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

describe('switchLayout', () => {
  it.each([
    ['цфк', 'war'],
    ['Dslmvfr', 'Відьмак'],
    ['ыдууз', 'sleep'],
  ])('%s → %s', (input, expected) => {
    expect(switchLayout(input)).toBe(expected);
  });

  it('returns nothing for a query no layout changes', () => {
    expect(switchLayout('2077')).toBeNull();
  });
});
