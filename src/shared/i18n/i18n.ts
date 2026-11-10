import { be } from '@lbk/i18n/be';
import { en } from '@lbk/i18n/en';
import { pl } from '@lbk/i18n/pl';
import { uk } from '@lbk/i18n/uk';
import i18next from 'i18next';
import { DEFAULT_LANGUAGE, type Language } from './languages';

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'translation';
    resources: { translation: typeof uk };
  }
}

export const i18n = i18next.createInstance();

void i18n.init({
  lng: DEFAULT_LANGUAGE,
  fallbackLng: false,
  initAsync: false,
  resources: {
    uk: { translation: uk },
    en: { translation: en },
    be: { translation: be },
    pl: { translation: pl },
  },
  // The default HTML escaping would show &amp; in game names; React escapes on render.
  interpolation: { escapeValue: false },
});

export const t = i18n.t.bind(i18n);

// Resources are preloaded, so the switch is synchronous.
export function setLanguage(language: Language): void {
  void i18n.changeLanguage(language);
}
