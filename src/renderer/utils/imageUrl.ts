import { getImageUrl } from '../../lib/api';

/**
 * Get full URL for game images from R2 Storage
 */
export function getGameImageUrl(imagePath: string | null): string | null {
  return getImageUrl(imagePath);
}
