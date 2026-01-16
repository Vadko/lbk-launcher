// Featured translations to highlight in the UI with trophy badge
interface FeaturedTranslation {
  gameSlug: string;
  team?: string; // If specified, only this team's translation is featured
  description: string;
  year: number;
}

export const FEATURED_TRANSLATIONS: FeaturedTranslation[] = [
  {
    gameSlug: 'persona_4_golden',
    description: 'Найочікуваніший переклад 2026 за версією спільноти',
    year: 2026,
  },
  {
    gameSlug: 'dispatch',
    description: 'Найкращий текстовий переклад 2025 за версією спільноти',
    year: 2025,
  },
];

// Check if a game (by slug) is featured
export const isFeaturedGame = (gameSlug: string): boolean => {
  return FEATURED_TRANSLATIONS.some((t) => t.gameSlug === gameSlug);
};

// Check if a specific translation is featured (game + team combo)
export const isFeaturedTranslation = (gameSlug: string, team?: string): boolean => {
  return FEATURED_TRANSLATIONS.some(
    (t) => t.gameSlug === gameSlug && (t.team === undefined || t.team === team)
  );
};

// Get featured info for a game/translation
export const getFeaturedInfo = (
  gameSlug: string,
  team?: string
): FeaturedTranslation | null => {
  return (
    FEATURED_TRANSLATIONS.find(
      (t) => t.gameSlug === gameSlug && (t.team === undefined || t.team === team)
    ) || null
  );
};
