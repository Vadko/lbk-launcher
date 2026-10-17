import { keepPreviousData } from '@tanstack/react-query';
import { useSettingsStore } from '../store/useSettingsStore';
import { useSyncAwareQuery } from './useSyncAwareQuery';

export const RATINGS_PAGE_SIZE = 10;

export function useTeamsRating(page: number) {
  const hideAi = useSettingsStore((state) => state.hideAiTranslations);
  return useSyncAwareQuery({
    queryKey: ['teams-rating', page, hideAi],
    queryFn: async () => {
      const result = await window.electronAPI.fetchTeamsRating(
        page,
        RATINGS_PAGE_SIZE,
        hideAi
      );
      if (!result) {
        throw new Error('Не вдалося завантажити рейтинг спілок');
      }
      return result;
    },
    placeholderData: keepPreviousData,
  });
}
