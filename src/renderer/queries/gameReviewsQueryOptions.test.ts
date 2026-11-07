import { InfiniteQueryObserver, QueryClient } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { GameReviewsListInput } from '@/shared/game-reviews-api-types';
import type { GameReviewsPage } from '@/shared/game-reviews-types';

const fetchReviewsPage = vi.hoisted(() =>
  vi.fn<(input: GameReviewsListInput) => Promise<GameReviewsPage>>()
);
vi.mock('./reviewsClient', () => ({ fetchReviewsPage }));

const { gameReviewsQueryOptions } = await import('./gameReviewsQueryOptions');

const ASKED = Date.UTC(2026, 9, 22, 10);
const NEXT_ASKED = ASKED + 60_000;

const page = (nextCursor: string | null): GameReviewsPage => ({
  items: [],
  total: 2,
  nextCursor,
  viewer: null,
});

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  fetchReviewsPage.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('gameReviewsQueryOptions', () => {
  it('stamps each page with the time it was asked for, which a next page leaves alone', async () => {
    const queryClient = new QueryClient();
    const options = gameReviewsQueryOptions('g1', null, null);
    fetchReviewsPage.mockImplementation(({ cursor }) => {
      // Each page lands two seconds after it was asked for
      vi.setSystemTime((cursor ? NEXT_ASKED : ASKED) + 2_000);
      return Promise.resolve(page(cursor ? null : 'c1'));
    });
    vi.setSystemTime(ASKED);
    await queryClient.fetchInfiniteQuery(options);

    vi.setSystemTime(NEXT_ASKED);
    const { data } = await new InfiniteQueryObserver(
      queryClient,
      options
    ).fetchNextPage();

    expect(data?.pages.map(({ fetchedAt }) => fetchedAt)).toEqual([ASKED, NEXT_ASKED]);
  });
});
