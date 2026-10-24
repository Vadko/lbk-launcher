import { t } from '@/shared/i18n/i18n';

const LANGUAGE_CODES = [
  'EN',
  'GB',
  'FR',
  'IT',
  'DE',
  'ES',
  'JA',
  'KO',
  'PL',
  'CS',
  'ZH_CN',
  'ZH_TW',
  'ZH',
  'PT',
  'UK',
] as const;

/**
 * Get human-readable language name for hint display
 * @param code - ISO language code (e.g., "PL", "EN")
 * @returns Localized language name in accusative case or null if not found
 */
export function getLanguageHint(code: string | null | undefined): string | null {
  if (!code) {
    return null;
  }
  const upper = code.toUpperCase();
  const known = LANGUAGE_CODES.find((candidate) => candidate === upper);
  return known ? t(`gameLanguage.${known}`) : null;
}
