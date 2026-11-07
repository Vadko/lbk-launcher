// List of special translators to highlight in the UI
interface SpecialTranslator {
  name: string;
  team?: string;
  role: 'earlySupporter' | 'launcherTeam';
}

export const SPECIAL_TRANSLATORS: SpecialTranslator[] = [
  {
    name: 'Владислав',
    team: 'Sent_DeZ',
    role: 'earlySupporter',
  },
  {
    name: 'Вена',
    team: 'Ліниві ШІ',
    role: 'earlySupporter',
  },
  {
    name: 'Євгеній',
    team: 'kurasagi',
    role: 'earlySupporter',
  },
  {
    name: 'Костянтин',
    team: 'Перекладач Патріотів (KostyanChek8)',
    role: 'earlySupporter',
  },
  {
    name: 'GameGlobe Localization',
    team: 'GameGlobe Localization',
    role: 'launcherTeam',
  },
  {
    name: 'Little Bit',
    team: 'Little Bit',
    role: 'launcherTeam',
  },
];

// Get all team names for matching
const SPECIAL_TRANSLATOR_TEAMS = SPECIAL_TRANSLATORS.filter(
  (translator) => translator.team
).map((translator) => translator.team!.toLowerCase());

const SPECIAL_TRANSLATOR_NAMES = SPECIAL_TRANSLATORS.map((translator) =>
  translator.name.toLowerCase()
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
      (translator) =>
        translator.name.toLowerCase() === authorLower ||
        (translator.team && translator.team.toLowerCase() === authorLower)
    ) || null
  );
};
