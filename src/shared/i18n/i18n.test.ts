import { be } from '@lbk/i18n/be';
import { en } from '@lbk/i18n/en';
import { pl } from '@lbk/i18n/pl';
import { uk } from '@lbk/i18n/uk';
import { afterEach, describe, expect, it } from 'vitest';
import { changeLanguage, i18n, t } from './i18n';
import { LANGUAGES } from './languages';

afterEach(() => changeLanguage('uk'));

describe('t', () => {
  it.each([
    [1, 'one'],
    [3, 'few'],
    [5, 'many'],
    [11, 'many'],
    [21, 'one'],
    [22, 'few'],
  ] as const)('picks the uk plural form for %i', (count, form) => {
    expect(t('authorSubscription.authorsCount', { count })).toBe(
      uk.authorSubscription[`authorsCount_${form}`].replace('{{count}}', String(count))
    );
  });

  it.each([
    [1, 'one'],
    [3, 'few'],
    [5, 'many'],
    [12, 'many'],
    [22, 'few'],
  ] as const)('picks the pl plural form for %i', async (count, form) => {
    await changeLanguage('pl');

    expect(t('pendingLaunchOptions.games', { count })).toBe(
      pl.pendingLaunchOptions[`games_${form}`].replace('{{count}}', String(count))
    );
  });
});

describe('changeLanguage', () => {
  it.each(LANGUAGES)('makes t answer in %s', async (language) => {
    await changeLanguage(language);

    expect([i18n.language, t('tray.open')]).toEqual([
      language,
      { uk, en, be, pl }[language].tray.open,
    ]);
  });
});
