/**
 * Language code to human-readable name mapping
 * Used for displaying language hints in the UI
 */

const LANGUAGE_NAMES: Record<string, string> = {
  EN: 'англійську',
  FR: 'французьку',
  IT: 'італійську',
  DE: 'німецьку',
  ES: 'іспанську',
  JA: 'японську',
  KO: 'корейську',
  PL: 'польську',
  ZH_CN: 'китайську (спрощена)',
  ZH_TW: 'китайську (традиційна)',
  ZH: 'китайську',
  PT: 'португальську',
  UK: 'українську',
};

/**
 * Get human-readable language name for hint display
 * @param code - ISO language code (e.g., "PL", "EN")
 * @returns Localized language name in accusative case or null if not found
 */
export function getLanguageHint(code: string | null | undefined): string | null {
  if (!code) return null;
  return LANGUAGE_NAMES[code.toUpperCase()] ?? null;
}
