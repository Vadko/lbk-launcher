// List of special translators to highlight in the UI
export interface SpecialTranslator {
  name: string;
  team?: string;
  description: string;
}

const SPECIAL_DESCRIPTION = 'Допомагає розвивати LBK Launcher з перших днів';

export const SPECIAL_TRANSLATORS: SpecialTranslator[] = [
  { name: 'Владислав', team: 'Sent_DeZ', description: SPECIAL_DESCRIPTION },
  { name: 'Вена', team: 'Ліниві ШІ', description: SPECIAL_DESCRIPTION },
  { name: 'Євгеній', team: 'kurasagi', description: SPECIAL_DESCRIPTION },
  { name: 'Костянтин', team: 'KostyanChek8', description: SPECIAL_DESCRIPTION },
  { name: 'GameGlobe Localization', team: 'GameGlobe Localization', description: 'Команда лаунчера' },
  { name: 'Little Bit', team: 'Little Bit', description: 'Команда лаунчера' },
];

// Get all team names for matching
export const SPECIAL_TRANSLATOR_TEAMS = SPECIAL_TRANSLATORS.filter((t) => t.team).map(
  (t) => t.team!.toLowerCase()
);

export const SPECIAL_TRANSLATOR_NAMES = SPECIAL_TRANSLATORS.map((t) =>
  t.name.toLowerCase()
);

// Check if a team name matches any special translator
export const isSpecialTranslator = (teamName: string): boolean => {
  const teamLower = teamName.toLowerCase();
  return (
    SPECIAL_TRANSLATOR_TEAMS.some((team) => teamLower.includes(team)) ||
    SPECIAL_TRANSLATOR_NAMES.some((name) => teamLower.includes(name))
  );
};

// Get special translator info for a specific author name
export const getSpecialTranslatorInfo = (
  authorName: string
): SpecialTranslator | null => {
  const authorLower = authorName.toLowerCase().trim();
  return (
    SPECIAL_TRANSLATORS.find(
      (t) =>
        t.name.toLowerCase() === authorLower ||
        (t.team && t.team.toLowerCase() === authorLower)
    ) || null
  );
};

// Check if a single author name is a special translator
export const isAuthorSpecial = (authorName: string): boolean =>
  getSpecialTranslatorInfo(authorName) !== null;
