import { getImageUrl } from '../../lib/api';

/**
 * Get full URL for game images from R2 Storage
 * @param imagePath - path to the image
 * @param updatedAt - last update timestamp, for cache-busting
 */
export function getGameImageUrl(
  imagePath: string | null,
  updatedAt?: string | null
): string | null {
  return getImageUrl(imagePath, updatedAt);
}
