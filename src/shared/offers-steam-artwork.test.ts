import { describe, expect, it } from 'vitest';
import { offersSteamArtwork } from './offers-steam-artwork';
import type { Platform } from './types';

const game = (overrides: Partial<Parameters<typeof offersSteamArtwork>[0]> = {}) => ({
  steam_app_id: 1332010,
  capsule_path: 'id/capsule.webp',
  banner_path: 'id/banner.webp',
  logo_path: 'id/logo.webp',
  artwork_localized: true,
  ...overrides,
});

const noImages = { capsule_path: null, banner_path: null, logo_path: null };

describe('offersSteamArtwork', () => {
  it.each<[string, ReturnType<typeof game>, Platform, boolean]>([
    ['localized artwork of a Steam game', game(), 'steam', true],
    ['a capsule alone', game({ ...noImages, capsule_path: 'c.webp' }), 'steam', true],
    ['a banner alone', game({ ...noImages, banner_path: 'b.webp' }), 'steam', true],
    ['a logo alone', game({ ...noImages, logo_path: 'l.webp' }), 'steam', true],
    ['artwork that is not localized', game({ artwork_localized: false }), 'steam', false],
    ['no images', game(noImages), 'steam', false],
    ['no Steam app id', game({ steam_app_id: null }), 'steam', false],
    ['another store', game(), 'epic', false],
  ])('%s', (_case, row, platform, expected) => {
    expect(offersSteamArtwork(row, platform)).toBe(expected);
  });
});
