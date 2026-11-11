import { type Messages, uk } from '@lbk/i18n/uk';
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
  resources: { uk: { translation: uk } },
  // The default HTML escaping would show &amp; in game names; React escapes on render.
  interpolation: { escapeValue: false },
});

export const t = i18n.t.bind(i18n);

const DICTIONARIES: Record<Language, () => Promise<Messages>> = {
  uk: () => Promise.resolve(uk),
  en: () => import('@lbk/i18n/en').then((module) => module.en),
  be: () => import('@lbk/i18n/be').then((module) => module.be),
  pl: () => import('@lbk/i18n/pl').then((module) => module.pl),
};

export async function changeLanguage(language: Language): Promise<void> {
  if (!i18n.hasResourceBundle(language, 'translation')) {
    i18n.addResourceBundle(language, 'translation', await DICTIONARIES[language]());
  }
  await i18n.changeLanguage(language);
}
