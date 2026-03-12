import kuli from '../../../resources/kuli.png';
import team from '../../../resources/team.svg';
import { fetchPlacements } from '../api/placements';
import type { PlacementData } from '../types/placement';
import { useSyncAwareQuery } from './useSyncAwareQuery';

const ONE_HOUR = 1; //60 * 60 * 1000; // Cache для placements оновлюється кожну годину

/**
 * Query keys для placements
 */
export const placementKeys = {
  all: ['placements'] as const,
  byType: (type?: 'small_square' | 'narrow' | 'large_popup') =>
    [...placementKeys.all, type || 'all'] as const,
};

/**
 * Статичні заглушки для placements якщо API не повертає результати
 */
export const FALLBACK_PLACEMENTS: PlacementData[] = [
  {
    id: 'team',
    type: 'small_square',
    title: 'Стань частиною команди',
    subtitle: 'Допоможи перекласти цю гру українською',
    image_path: team,
    button_text: 'Долучитися →',
    link: 'https://lokalize.org/support',
  },
  {
    id: 'kuli',
    type: 'narrow',
    title: 'Скільки вже зіграли з цим перекладом годин:',
    subtitle: 'З цим перекладом вже награли {number} годин',
    icon_path: kuli,
    button_text: 'Перейти на KULI →',
    link: 'https://kuli.com.ua/',
  },
];

/**
 * Отримати placements з API або статичні заглушки
 */
export function usePlacements(type?: 'small_square' | 'narrow' | 'large_popup') {
  return useSyncAwareQuery({
    queryKey: placementKeys.byType(type),
    queryFn: async (): Promise<PlacementData[]> => {
      try {
        const placements = await fetchPlacements(type);

        // Якщо API повернув пусті результати, використовуємо fallback
        if (!placements || placements.length === 0) {
          console.log(
            '[Placements] API returned empty results, using fallback placements'
          );
          return FALLBACK_PLACEMENTS.filter(
            (placement) => !type || placement.type === type
          );
        }

        // Placements вже відфільтровані та відсортовані в API функції
        return placements;
      } catch (error) {
        console.error('[Placements] Error fetching placements:', error);

        // У випадку помилки також використовуємо fallback
        return FALLBACK_PLACEMENTS.filter(
          (placement) => !type || placement.type === type
        );
      }
    },
    staleTime: ONE_HOUR,
    gcTime: ONE_HOUR * 2,
    retry: 2,
  });
}
