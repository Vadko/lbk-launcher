import { describe, expect, it, vi } from 'vitest';
import type { DeepLinkTarget } from '@/shared/game-link-target';
import { parseDeepLink } from './deep-link';

describe('parseDeepLink', () => {
  it.each<[string, string, DeepLinkTarget | null]>([
    [
      'reads the game and its team',
      'lbk://games/digging_a_hole/Little%20Bit',
      { slug: 'digging_a_hole', team: 'Little Bit', openReviews: false },
    ],
    [
      'reads a link without a host',
      'lbk:///games/digging_a_hole/Little%20Bit',
      { slug: 'digging_a_hole', team: 'Little Bit', openReviews: false },
    ],
    [
      'opens the reviews tab',
      'lbk://games/digging_a_hole/Little%20Bit?tab=reviews',
      { slug: 'digging_a_hole', team: 'Little Bit', openReviews: true },
    ],
    [
      'ignores any other tab',
      'lbk://games/digging_a_hole/Little%20Bit?tab=recommended',
      { slug: 'digging_a_hole', team: 'Little Bit', openReviews: false },
    ],
    ['rejects a link without a team', 'lbk://games/digging_a_hole', null],
    ['rejects another path', 'lbk://news/digging_a_hole/Little%20Bit', null],
    ['rejects another protocol', 'https://games/digging_a_hole/Little%20Bit', null],
  ])('%s', (_case, url, expected) => {
    expect(parseDeepLink(url)).toEqual(expected);
  });

  it('rejects a malformed escape', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(parseDeepLink('lbk://games/digging_a_hole/%E0%A4%A')).toBeNull();
  });
});
