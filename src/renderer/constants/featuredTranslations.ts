// Featured translations to highlight in the UI with trophy badge
interface FeaturedTranslation {
  gameSlug: string;
  team?: string; // If specified, only this team's translation is featured
  award: 'mostAnticipated2026' | 'bestText2025';
  year: number;
}

const FEATURED_TRANSLATIONS: FeaturedTranslation[] = [
  {
    gameSlug: 'persona_4_golden',
    award: 'mostAnticipated2026',
    year: 2026,
  },
  {
    gameSlug: 'dispatch',
    award: 'bestText2025',
    year: 2025,
  },
];

// Get featured info for a game/translation
export const getFeaturedInfo = (
  gameSlug: string,
  team?: string
): FeaturedTranslation | null => {
  return (
    FEATURED_TRANSLATIONS.find(
      (featured) =>
        featured.gameSlug === gameSlug &&
        (featured.team === undefined || featured.team === team)
    ) || null
  );
};
