/**
 * R2 public URL for images (via custom domain)
 */
const R2_IMAGES_URL =
  import.meta.env.VITE_R2_IMAGES_URL || 'https://images.lblauncher.com';

/**
 * Отримати URL зображення з R2
 */
export function getImageUrl(imagePath: string | null): string | null {
  if (!imagePath) return null;

  // Already a full URL
  if (imagePath.startsWith('http')) return imagePath;

  // Remove leading slash if present
  const cleanPath = imagePath.startsWith('/') ? imagePath.slice(1) : imagePath;

  return `${R2_IMAGES_URL}/${cleanPath}`;
}
