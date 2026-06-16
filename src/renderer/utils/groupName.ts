import type { Game } from '../types/game';

interface GroupNaming {
  name: string;
  variantById: Map<string, string>;
}

const TRAILING_JUNK = /(?:[\s([{]+|[^\p{L}\p{N})\]}]+)+$/u;
const LEADING_JUNK = /^[^\p{L}\p{N}([{]+/u;

/**
 * Derives a clean shared title plus per-translation variant suffixes for a
 * group of translations of the same game. E.g.:
 *   ["Stray", "Stray (без озвучення)"] → name="Stray", variants {b:"(без озвучення)"}
 *   ["Стрей: Dlc1", "Стрей: Dlc2"]   → name="Стрей",  variants {a:"Dlc1", b:"Dlc2"}
 */
export function deriveGroupNaming(translations: Game[]): GroupNaming {
  if (translations.length < 2) {
    return { name: translations[0]?.name ?? '', variantById: new Map() };
  }

  const names = sortCaseInsensitive(translations.map((t) => t.name));
  const prefix = cleanPrefix(commonPrefix(names[0], names.at(-1)!), names);

  if (!prefix) {
    return { name: names[0], variantById: new Map() };
  }

  const variantById = new Map<string, string>();
  for (const t of translations) {
    const tail = t.name.slice(prefix.length).replace(LEADING_JUNK, '').trim();
    if (tail) variantById.set(t.id, tail);
  }
  return { name: prefix, variantById };
}

function sortCaseInsensitive(strings: string[]): string[] {
  return [...strings].sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
}

/**
 * Longest case-insensitive common prefix of two strings, sliced from `a`.
 * After a case-insensitive sort the common prefix of *all* strings equals
 * the common prefix of the first and last — so only two need comparing.
 */
function commonPrefix(a: string, b: string): string {
  const aLower = a.toLowerCase();
  const bLower = b.toLowerCase();
  const max = Math.min(aLower.length, bLower.length);
  let i = 0;
  while (i < max && aLower[i] === bLower[i]) i++;
  return a.slice(0, i);
}

/**
 * Snap a raw prefix to a sensible boundary: drop a trailing partial word if
 * the prefix cut mid-token, then strip any trailing whitespace, punctuation,
 * or unbalanced opener (`(`, `[`, `{`) that survives.
 */
function cleanPrefix(rawPrefix: string, allNames: string[]): string {
  let prefix = rawPrefix;
  const lastChar = prefix.at(-1);
  const cutMidToken = allNames.some(
    (n) => prefix.length < n.length && /\S/.test(n[prefix.length])
  );
  if (cutMidToken && lastChar && /\S/.test(lastChar)) {
    prefix = prefix.replace(/\S+$/, '');
  }
  return prefix.replace(TRAILING_JUNK, '').trim();
}
