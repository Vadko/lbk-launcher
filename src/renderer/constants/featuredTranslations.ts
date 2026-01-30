// Featured translations to highlight in the UI with trophy badge
interface FeaturedTranslation {
  gameSlug: string;
  team?: string; // If specified, only this team's translation is featured
  description: string;
  year: number;
}

const FEATURED_TRANSLATIONS: FeaturedTranslation[] = [
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

// Get featured info for a game/translation
export const getFeaturedInfo = (
  gameSlug: string,
  team?: string
): FeaturedTranslation | null => (
    FEATURED_TRANSLATIONS.find(
      (t) => t.gameSlug === gameSlug && (t.team === undefined || t.team === team)
    ) || null
  );
