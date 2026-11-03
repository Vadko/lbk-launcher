import type { RatingsPageInput } from '@/shared/ratings-api-types';
import { useSettingsStore } from '../store/useSettingsStore';
import { ratingsKey } from './ratingsKey';
import { useSyncAwareInfiniteQuery } from './useSyncAwareInfiniteQuery';

const PAGE_SIZE = 30;

export function useRatings<T>(
  kind: 'teams' | 'games',
  fetchPage: (input: RatingsPageInput) => Promise<T[] | null>
) {
  const hideAi = useSettingsStore((state) => state.hideAiTranslations);
  return useSyncAwareInfiniteQuery({
    queryKey: [...ratingsKey, kind, hideAi],
    queryFn: async ({ pageParam }) => {
      const page = await fetchPage({ offset: pageParam, limit: PAGE_SIZE, hideAi });
      if (!page) {
        throw new Error(`Could not read the ${kind} rating`);
      }
      return page;
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) =>
      lastPage.length < PAGE_SIZE ? undefined : allPages.length * PAGE_SIZE,
    // Counters change while the page is closed, and nothing invalidates it then
    staleTime: 0,
    select: (data) => data.pages.flat(),
  });
}
