import { describe, expect, it } from 'vitest';
import type { Game } from '@/shared/types';
import { reviewCounts } from './reviewCounts';

const game = (fields: Pick<Game, 'hide' | 'reviews' | 'error_reviews'>) => fields as Game;

describe('reviewCounts', () => {
  it('splits the game counters into the filter counts', () => {
    expect(reviewCounts(game({ hide: false, reviews: 7, error_reviews: 2 }))).toEqual({
      all: 7,
      feedback: 5,
      error: 2,
    });
  });

  it('counts nothing for a hidden game', () => {
    expect(reviewCounts(game({ hide: true, reviews: 7, error_reviews: 2 }))).toEqual({
      all: 0,
      feedback: 0,
      error: 0,
    });
  });
});
