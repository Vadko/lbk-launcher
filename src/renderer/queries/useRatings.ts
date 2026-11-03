import { useSettingsStore } from '../store/useSettingsStore';
import { ratingsKey } from './ratingsKey';
import { useSyncAwareQuery } from './useSyncAwareQuery';

export function useRatings<T>(
  kind: 'teams' | 'games',
  fetchRating: (hideAi: boolean) => Promise<T[] | null>
) {
  const hideAi = useSettingsStore((state) => state.hideAiTranslations);
  return useSyncAwareQuery({
    queryKey: [...ratingsKey, kind, hideAi],
    queryFn: async () => {
      const rating = await fetchRating(hideAi);
      if (!rating) {
        throw new Error(`Could not read the ${kind} rating`);
      }
      return rating;
    },
    // Counters change while the page is closed, and nothing invalidates it then
    staleTime: 0,
  });
}
