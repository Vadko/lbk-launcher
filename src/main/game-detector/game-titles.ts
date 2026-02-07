export const GAME_TITLE_MAPPING: Record<string, string | string[]> = {
  'Відьмак 3: Дикий гін': [
    'The Witcher 3: Wild Hunt - Complete Edition',
    'The Witcher 3: Wild Hunt - Game of the Year Edition',
    'The Witcher 3: Wild Hunt',
  ],

  'Відьмак 2: Убивці королів – Розширене видання':
    'The Witcher 2: Assassins of Kings Enhanced Edition',

  'Відьмак: Розширене видання – Режисерська версія': 'The Witcher: Enhanced Edition',

  'The Talos Principle': 'The Talos Principle: Gold Edition',

  'Kingdom: New Lands': 'Kingdom New Lands',
  'Darkest Dungeon': 'Darkest Dungeon®',
};

/**
 * Get clean title from mapping or return original
 */
export function getCleanTitle(title: string): string {
  if (!title) return title;

  const lowerTitle = title.toLowerCase();

  // Reverse lookup: Check if 'title' matches any Value in the mapping
  // We want to map GOG/Epic title (Value) -> DB Title (Key)
  for (const [dbName, gogNameOrArray] of Object.entries(GAME_TITLE_MAPPING)) {
    if (Array.isArray(gogNameOrArray)) {
      // Check if any of the variants match
      if (gogNameOrArray.some((variant) => variant.toLowerCase() === lowerTitle)) {
        return dbName;
      }
    } else {
      // String check
      if (gogNameOrArray.toLowerCase() === lowerTitle) {
        return dbName;
      }
    }
  }

  return title;
}
