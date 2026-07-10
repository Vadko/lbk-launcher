/**
 * Storage public URL for images
 */
const STORAGE_IMAGES_URL = import.meta.env.VITE_STORAGE_IMAGES_URL;

/**
 * Отримати URL зображення зі Storage
 * @param imagePath - шлях до зображення
 * @param updatedAt - timestamp останнього оновлення для cache-busting
 */
export function getImageUrl(
  imagePath: string | null,
  updatedAt?: string | null
): string | null {
  if (!imagePath) {
    return null;
  }

  // Already a full URL
  if (imagePath.startsWith('http')) {
    if (updatedAt) {
      const separator = imagePath.includes('?') ? '&' : '?';
      return `${imagePath}${separator}v=${new Date(updatedAt).getTime()}`;
    }
    return imagePath;
  }

  // Remove leading slash if present
  const cleanPath = imagePath.startsWith('/') ? imagePath.slice(1) : imagePath;

  const baseUrl = `${STORAGE_IMAGES_URL}/${cleanPath}`;

  // Cache-busting: додати timestamp щоб браузер завантажив нову версію при оновленні
  if (updatedAt) {
    return `${baseUrl}?v=${new Date(updatedAt).getTime()}`;
  }

  return baseUrl;
}
