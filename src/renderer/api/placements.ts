/**
 * API утиліти для роботи з placements через HTTP запити
 */
import type { PlacementData } from '../types/placement';

// API endpoints
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://api.lokalize.org';

/**
 * Отримати placements з API сервера
 */
export async function fetchPlacements(
  type?: 'small_square' | 'narrow' | 'large_popup'
): Promise<PlacementData[]> {
  try {
    let url = `${API_BASE_URL}/placements?active=true`;

    // Фільтруємо за типом якщо заданий
    if (type) {
      url += `&type=${type}`;
    }

    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as PlacementData[];

    // Фільтруємо тільки активні placements і сортуємо за пріоритетом
    return data.filter((p) => p.isActive).sort((a, b) => b.priority - a.priority);
  } catch (error) {
    console.error('[Placements API] Error fetching placements:', error);
    // Повертаємо пустий масив при помилці - fallback placements обробляться в React Query
    return [];
  }
}
