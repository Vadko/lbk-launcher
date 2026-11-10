export const LANGUAGES = ['uk', 'en', 'be', 'pl'] as const;

export type Language = (typeof LANGUAGES)[number];

export const DEFAULT_LANGUAGE: Language = 'uk';

export function isLanguage(value: unknown): value is Language {
  return LANGUAGES.some((language) => language === value);
}
