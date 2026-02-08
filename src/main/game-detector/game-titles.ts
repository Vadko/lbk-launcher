const GAME_TITLE_MAPPING: Record<string, string | string[]> = {
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

  'Kingdom Come Deliverance': 'Kingdom Come: Deliverance',
  'Serious Sam HD: The First Encounter': 'Serious Sam: The First Encounter',

  'Batman: Arkham City - Game of the Year Edition':
    'Batman™ Arkham City - Game of the Year Edition',

  'Rustler': 'Rustler - Grand Theft Horse',
  'Batman: Arkham Asylum Game of the Year Edition':
    'Batman™ Arkham Asylum Game of the Year Edition',
  'Batman™: Arkham Knight': 'Batman™ Arkham Knight',
  'Darksiders 2: Deathinitive edition': 'Darksiders II Deathinitive Edition',
  'Tandem: A Tale of Shadows': 'Tandem A Tale of Shadows',
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
    } else if (gogNameOrArray.toLowerCase() === lowerTitle) {
      // String check
      return dbName;
    }
  }

  return title;
}
