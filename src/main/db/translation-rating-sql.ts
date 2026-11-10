// A negative counter would put a log10 of zero or less into the sum
const counter = (column: string) => `MAX(COALESCE(${column}, 0), 0)`;

// The like rate starts at 10 % worth 70 downloads, so a few early likes do not top a list; lbk-admin's translation_rating() (migration 211) is the landing's copy, change both together
export const TRANSLATION_RATING_SQL = `(
  0.45 * (${counter('likes')} + 70 * 0.1) / (${counter('downloads')} + 70)
  + 0.25 * CASE WHEN ai IS NULL THEN 1 WHEN ai = 'edited' THEN 0.8 ELSE 0.55 END
  + 0.2 * log10(${counter('downloads')} + 1)
  + 0.1 * log10(${counter('reviews')} + 1)
)`;

// Ascending, so manual translations come first
export const MANUAL_FIRST_SQL = 'ai IS NOT NULL';

// A game's translations: manual first, each kind by rating, then the more complete one
export const TRANSLATION_RANK_SQL = `${MANUAL_FIRST_SQL}, ${TRANSLATION_RATING_SQL} DESC, translation_progress DESC`;
