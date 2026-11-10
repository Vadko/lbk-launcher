import type Database from 'better-sqlite3';
import { translationRating } from '@/shared/translation-rating';

export const TRANSLATION_RATING_SQL = 'translation_rating(likes, downloads, reviews, ai)';

// Ascending, so manual translations come first
export const MANUAL_FIRST_SQL = 'ai IS NOT NULL';

// The renderer ranks a game's translations with the same function, so SQL calls it rather than a copy
export function registerTranslationRating(db: Database.Database): void {
  db.function(
    'translation_rating',
    { deterministic: true },
    (likes: number, downloads: number | null, reviews: number, ai: string | null) =>
      translationRating({ likes, downloads, reviews, ai })
  );
}
