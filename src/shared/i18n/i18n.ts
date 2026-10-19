import { uk } from '@lbk/i18n/uk';
import i18next from 'i18next';

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'translation';
    resources: { translation: typeof uk };
  }
}

export const i18n = i18next.createInstance();

void i18n.init({
  lng: 'uk',
  fallbackLng: false,
  initAsync: false,
  resources: { uk: { translation: uk } },
  // The default HTML escaping would show &amp; in game names; React escapes on render.
  interpolation: { escapeValue: false },
});

export const t = i18n.t.bind(i18n);
