import {
  type UseQueryOptions,
  type UseQueryResult,
  useQuery,
} from '@tanstack/react-query';
import { useStore } from '../store/useStore';

/**
 * Wrapper for useQuery that automatically waits for the Supabase sync to finish.
 * Use this hook instead of useQuery for queries against the local database.
 */
export function useSyncAwareQuery<
  TQueryFnData = unknown,
  TError = Error,
  TData = TQueryFnData,
>(options: UseQueryOptions<TQueryFnData, TError, TData>): UseQueryResult<TData, TError> {
  const syncStatus = useStore((state) => state.syncStatus);
  const isSyncReady = syncStatus === 'ready' || syncStatus === 'error';

  return useQuery({
    ...options,
    // Combine with the existing enabled if present
    enabled: isSyncReady && (options.enabled ?? true),
  });
}
