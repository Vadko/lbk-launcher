import { keepPreviousData } from '@tanstack/react-query';
import { useSettingsStore } from '../store/useSettingsStore';
import { useSyncAwareQuery } from './useSyncAwareQuery';
import { RATINGS_PAGE_SIZE } from './useTeamsRating';

export function useGamesRating(page: number) {
  const hideAi = useSettingsStore((state) => state.hideAiTranslations);
  return useSyncAwareQuery({
    queryKey: ['games-rating', page, hideAi],
    queryFn: async () => {
      const result = await window.electronAPI.fetchGamesRating(
        page,
        RATINGS_PAGE_SIZE,
        hideAi
      );
      if (!result) {
        throw new Error('Не вдалося завантажити рейтинг ігор');
      }
      return result;
    },
    placeholderData: keepPreviousData,
  });
}
