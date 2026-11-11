import { describe, expect, it } from 'vitest';
import { DEFAULT_LANGUAGE, isLanguage } from './languages';

describe('isLanguage', () => {
  it.each([
    ['uk', true],
    ['en', true],
    ['be', true],
    ['pl', true],
    ['de', false],
    ['', false],
    ['UK', false],
    [null, false],
    [undefined, false],
    [1, false],
  ] as const)('answers %j with %s', (value, expected) => {
    expect(isLanguage(value)).toBe(expected);
  });

  it('defaults to a supported language', () => {
    expect(isLanguage(DEFAULT_LANGUAGE)).toBe(true);
  });
});
