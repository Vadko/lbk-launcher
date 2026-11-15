export const LANGUAGES = ['uk', 'en', 'be', 'pl'] as const;

export type Language = (typeof LANGUAGES)[number];

export const DEFAULT_LANGUAGE: Language = 'uk';

// Each language is named in itself, the same whatever the interface language.
export const LANGUAGE_NAMES = {
  // eslint-disable-next-line no-restricted-syntax -- an autonym, not text to translate
  uk: 'Українська',
  en: 'English',
  // eslint-disable-next-line no-restricted-syntax -- an autonym, not text to translate
  be: 'Беларуская',
  pl: 'Polski',
} as const satisfies Record<Language, string>;

export function isLanguage(value: unknown): value is Language {
  return LANGUAGES.some((language) => language === value);
}
