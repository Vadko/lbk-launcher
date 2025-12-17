import { getImageUrl } from '../../lib/api';

/**
 * Get full URL for game images from R2 Storage
 * @param imagePath - шлях до зображення
 * @param updatedAt - timestamp останнього оновлення для cache-busting
 */
export function getGameImageUrl(
  imagePath: string | null,
  updatedAt?: string | null
): string | null {
  return getImageUrl(imagePath, updatedAt);
}
