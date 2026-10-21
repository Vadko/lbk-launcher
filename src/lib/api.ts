/**
 * Storage public URL for images
 */
const STORAGE_IMAGES_URL = import.meta.env.VITE_STORAGE_IMAGES_URL;

/**
 * Get an image URL from Storage
 * @param imagePath - path to the image
 * @param updatedAt - timestamp of the last update, for cache-busting
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

  // Cache-busting: add a timestamp so the browser loads the new version on update
  if (updatedAt) {
    return `${baseUrl}?v=${new Date(updatedAt).getTime()}`;
  }

  return baseUrl;
}
