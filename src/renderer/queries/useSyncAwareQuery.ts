import {
  useQuery,
  type UseQueryOptions,
  type UseQueryResult,
} from '@tanstack/react-query';
import { useStore } from '../store/useStore';

/**
 * Wrapper для useQuery який автоматично чекає завершення sync з Supabase.
 * Використовуй цей хук замість useQuery для запитів до локальної бази даних.
 */
export function useSyncAwareQuery<
  TQueryFnData = unknown,
  TError = Error,
  TData = TQueryFnData,
>(
  options: UseQueryOptions<TQueryFnData, TError, TData>
): UseQueryResult<TData, TError> {
  const syncStatus = useStore((state) => state.syncStatus);
  const isSyncReady = syncStatus === 'ready' || syncStatus === 'error';

  return useQuery({
    ...options,
    // Комбінуємо з існуючим enabled якщо він є
    enabled: isSyncReady && (options.enabled ?? true),
  });
}
