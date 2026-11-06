import { describe, expect, it } from 'vitest';
import { formatDownloads, hasExactDownloads } from './formatters';
import { t } from './i18n/i18n';

describe('downloads', () => {
  it.each([
    ['no count', null, false],
    ['zero', 0, false],
    ['1', 1, false],
    ['19', 19, false],
    ['20', 20, true],
    ['1234', 1234, true],
  ])('shows %s exactly: %s', (_, downloads, expected) => {
    expect(hasExactDownloads(downloads)).toBe(expected);
  });

  it('formats a low count as a range', () => {
    expect(formatDownloads(5)).toBe(t('gameInfo.downloadsUnder20'));
  });

  it('groups thousands', () => {
    expect(formatDownloads(1234)).toBe(new Intl.NumberFormat('uk-UA').format(1234));
  });
});
