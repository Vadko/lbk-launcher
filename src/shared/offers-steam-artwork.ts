import type { Game, Platform } from './types';

type ArtworkGame = Pick<
  Game,
  'steam_app_id' | 'capsule_path' | 'banner_path' | 'logo_path' | 'artwork_localized'
>;

// Images alone are not enough: most translations keep the store's original art in those slots.
export function offersSteamArtwork(game: ArtworkGame, platform: Platform): boolean {
  return (
    platform === 'steam' &&
    !!game.steam_app_id &&
    game.artwork_localized &&
    !!(game.capsule_path || game.banner_path || game.logo_path)
  );
}
