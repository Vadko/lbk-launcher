// List of special translators to highlight in the UI
export interface SpecialTranslator {
  name: string;
  team?: string;
}

export const SPECIAL_TRANSLATORS: SpecialTranslator[] = [
  { name: 'Владислав', team: 'Sent_Dez' },
  { name: 'Вена', team: 'Ліниві ШІ' },
  { name: 'Віталій', team: 'GameGlobe Localization' },
  { name: 'Євгеній' },
  { name: 'Костянтин', team: 'KostyanChek8' },
];

// Get all team names for matching
export const SPECIAL_TRANSLATOR_TEAMS = SPECIAL_TRANSLATORS
  .filter((t) => t.team)
  .map((t) => t.team!.toLowerCase());

export const SPECIAL_TRANSLATOR_NAMES = SPECIAL_TRANSLATORS.map((t) => t.name.toLowerCase());

// Check if a team name matches any special translator
export const isSpecialTranslator = (teamName: string): boolean => {
  const teamLower = teamName.toLowerCase();
  return (
    SPECIAL_TRANSLATOR_TEAMS.some((team) => teamLower.includes(team)) ||
    SPECIAL_TRANSLATOR_NAMES.some((name) => teamLower.includes(name))
  );
};
