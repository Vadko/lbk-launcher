import { describe, expect, it } from 'vitest';
import { settledResource } from './settledResource';

const FALLBACK = { games: [] };
const SHOWN = { games: ['a'] };

describe('settledResource', () => {
  it.each([
    ['still loading', undefined, false, undefined],
    ['a first read that failed', undefined, true, FALLBACK],
    ['a value', SHOWN, false, SHOWN],
    ['a later read that failed', SHOWN, true, SHOWN],
    ['a null value', null, false, null],
    ['a null value whose next read failed', null, true, null],
  ])('%s', (_label, value, failed, expected) => {
    expect(settledResource(value, failed, FALLBACK)).toBe(expected);
  });
});
