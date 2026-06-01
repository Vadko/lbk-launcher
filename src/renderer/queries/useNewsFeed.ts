import { useQuery } from '@tanstack/react-query';
import type { NewsFeedFilter, NewsFeedItem } from '../../shared/types';

const THIRTY_MINUTES = 30 * 60 * 1000;

export function useNewsFeed(filter: NewsFeedFilter) {
  return useQuery({
    queryKey: ['news-feed', filter],
    queryFn: (): Promise<NewsFeedItem[]> => window.electronAPI.fetchNewsFeed(filter),
    staleTime: THIRTY_MINUTES,
    gcTime: THIRTY_MINUTES,
  });
}
