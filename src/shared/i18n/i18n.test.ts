import { uk } from '@lbk/i18n/uk';
import { describe, expect, it } from 'vitest';
import { t } from './i18n';

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
