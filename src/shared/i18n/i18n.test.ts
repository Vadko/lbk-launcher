import { be } from '@lbk/i18n/be';
import { en } from '@lbk/i18n/en';
import { uk } from '@lbk/i18n/uk';
import { afterEach, describe, expect, it } from 'vitest';
import { setLanguage, t } from './i18n';
import { LANGUAGES } from './languages';

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
});

describe('setLanguage', () => {
  afterEach(() => setLanguage('uk'));

  it.each(LANGUAGES)('makes t answer in %s at once', (language) => {
    setLanguage(language);
    expect(t('tray.open')).toBe({ uk, en, be }[language].tray.open);
  });
});
