import { F } from '@mobily/ts-belt';
import { i18n } from './i18n';
import { isLanguage, type Language } from './languages';

export const LOCALES = {
  uk: 'uk-UA',
  en: 'en-US',
  be: 'be-BY',
  pl: 'pl-PL',
} as const satisfies Record<Language, string>;

export function currentLocale(): string {
  const { language } = i18n;
  return isLanguage(language) ? LOCALES[language] : LOCALES.uk;
}

// One Intl instance per locale, built on first use in that locale
export function perLocale<T>(make: (locale: string) => T): () => T {
  const forLocale = F.memoizeWithKey((locale: string) => locale, make);
  return () => forLocale(currentLocale());
}
