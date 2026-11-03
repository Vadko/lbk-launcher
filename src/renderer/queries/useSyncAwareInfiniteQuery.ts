import {
  type InfiniteData,
  type QueryKey,
  type UseInfiniteQueryOptions,
  type UseInfiniteQueryResult,
  useInfiniteQuery,
} from '@tanstack/react-query';
import { useStore } from '../store/useStore';

export function useSyncAwareInfiniteQuery<
  TQueryFnData,
  TData = InfiniteData<TQueryFnData>,
  TQueryKey extends QueryKey = QueryKey,
  TPageParam = unknown,
>(
  options: UseInfiniteQueryOptions<TQueryFnData, Error, TData, TQueryKey, TPageParam>
): UseInfiniteQueryResult<TData, Error> {
  const syncStatus = useStore((state) => state.syncStatus);
  const isSyncReady = syncStatus === 'ready' || syncStatus === 'error';

  return useInfiniteQuery({
    ...options,
    enabled: isSyncReady && (options.enabled ?? true),
  });
}
