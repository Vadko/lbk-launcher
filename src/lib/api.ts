import { supabase } from './supabase';

/**
 * Отримати URL зображення
 */
export function getImageUrl(imagePath: string | null): string | null {
  if (!imagePath) return null;

  const { data } = supabase.storage
    .from('game-images')
    .getPublicUrl(imagePath);

  return data.publicUrl;
}
