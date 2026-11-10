import { describe, expect, it } from 'vitest';
import { compareTranslationRank, translationRating } from './translation-rating';

interface Counters {
  ai: string | null;
  likes: number;
  downloads: number | null;
  reviews: number;
  translation_progress: number;
}

const translation = (overrides: Partial<Counters>): Counters => ({
  ai: null,
  likes: 0,
  downloads: 0,
  reviews: 0,
  translation_progress: 100,
  ...overrides,
});

describe('translationRating', () => {
  it.each([
    ['manual, no counters', translation({}), 0.045 + 0.25],
    ['downloads null counts as 0', translation({ downloads: null }), 0.045 + 0.25],
    ['AI with human editing', translation({ ai: 'edited' }), 0.045 + 0.2],
    ['raw AI', translation({ ai: 'non-edited' }), 0.045 + 0.1375],
    ['an unknown ai value as raw AI', translation({ ai: 'future' }), 0.045 + 0.1375],
    [
      'negative counters as 0',
      translation({ likes: -3, downloads: -5, reviews: -1 }),
      0.045 + 0.25,
    ],
    [
      'every term',
      translation({ likes: 93, downloads: 999, reviews: 9 }),
      (0.45 * 100) / 1069 + 0.25 + 0.2 * 3 + 0.1 * 1,
    ],
  ])('%s', (_label, counters, expected) => {
    expect(translationRating(counters)).toBeCloseTo(expected, 10);
  });
});

describe('compareTranslationRank', () => {
  it.each([
    [
      'a manual translation before a better rated AI one',
      translation({ downloads: 5 }),
      translation({ ai: 'edited', downloads: 5000, likes: 900 }),
    ],
    [
      'the better rated of two manual translations first',
      translation({ downloads: 500, likes: 60 }),
      translation({ downloads: 100, likes: 2 }),
    ],
    [
      'the better rated of two AI translations first, edited or not',
      translation({ ai: 'non-edited', downloads: 3000, likes: 300 }),
      translation({ ai: 'edited', downloads: 10 }),
    ],
    [
      'the more complete one on an equal rating',
      translation({ translation_progress: 90 }),
      translation({ translation_progress: 40 }),
    ],
  ])('%s', (_label, first, second) => {
    expect(compareTranslationRank(first, second)).toBeLessThan(0);
    expect(compareTranslationRank(second, first)).toBeGreaterThan(0);
  });
});
