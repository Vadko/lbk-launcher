import { describe, expect, it } from 'vitest';
import { formatDownloads, shownDownloads } from './formatters';
import { t } from './i18n/i18n';

describe('downloads', () => {
  it.each([
    ['no count', null, null],
    ['zero', 0, null],
    ['19', 19, null],
    ['20', 20, 20],
    ['1234', 1234, 1234],
  ])('shows %s', (_, downloads, expected) => {
    expect(shownDownloads(downloads)).toBe(expected);
  });

  it('formats a low count as a range', () => {
    expect(formatDownloads(5)).toBe(t('gameInfo.downloadsUnder20'));
  });

  it('groups thousands', () => {
    expect(formatDownloads(1234)).toBe(new Intl.NumberFormat('uk-UA').format(1234));
  });
});
