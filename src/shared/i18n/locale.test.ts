import { afterEach, describe, expect, it, vi } from 'vitest';
import { i18n } from './i18n';
import { DEFAULT_LANGUAGE, type Language } from './languages';
import { currentLocale, LOCALES, perLocale } from './locale';

afterEach(async () => {
  await i18n.changeLanguage(DEFAULT_LANGUAGE);
});

describe('LOCALES', () => {
  it('names only locales Intl formats in', () => {
    const locales = Object.values(LOCALES);
    expect(Intl.DateTimeFormat.supportedLocalesOf(locales)).toEqual(locales);
  });
});

describe('currentLocale', () => {
  it.each<[Language, string]>([
    ['uk', 'uk-UA'],
    ['en', 'en-US'],
    ['be', 'be-BY'],
    ['pl', 'pl-PL'],
  ])('%s formats as %s', async (language, locale) => {
    await i18n.changeLanguage(language);
    expect(currentLocale()).toBe(locale);
  });

  it('falls back to Ukrainian for a language outside the table', async () => {
    await i18n.changeLanguage('de');
    expect(currentLocale()).toBe('uk-UA');
  });
});

describe('perLocale', () => {
  it('builds one instance per locale and follows the language', async () => {
    const make = vi.fn((locale: string) => new Intl.NumberFormat(locale));
    const format = perLocale(make);

    expect(format().format(12345)).toBe(new Intl.NumberFormat('uk-UA').format(12345));
    expect(format()).toBe(format());
    await i18n.changeLanguage('en');
    expect(format().format(12345)).toBe('12,345');
    await i18n.changeLanguage('uk');
    format();

    expect(make.mock.calls).toEqual([['uk-UA'], ['en-US']]);
  });
});
