import { useInfiniteQuery } from '@tanstack/react-query';
import {
  NEWS_PAGE_SIZE,
  type NewsFeedFilter,
  type NewsFeedItem,
} from '../../shared/types';

type Cursor = string | undefined;

const THIRTY_MINUTES = 30 * 60 * 1000;

export function useNewsFeed(filter: NewsFeedFilter) {
  return useInfiniteQuery({
    queryKey: ['news-feed', filter],
    queryFn: ({ pageParam }) => window.electronAPI.fetchNewsFeed(filter, pageParam),
    initialPageParam: undefined as Cursor,
    getNextPageParam: (lastPage: NewsFeedItem[]): Cursor => {
      if (lastPage.length < NEWS_PAGE_SIZE) return undefined;
      return lastPage[lastPage.length - 1]?.publishedAt;
    },
    staleTime: THIRTY_MINUTES,
    gcTime: THIRTY_MINUTES,
    select: (data) => data.pages.flat(),
  });
}
