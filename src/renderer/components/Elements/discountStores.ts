import { steamStoreUrl } from '@/shared/steam-urls';
import type { DiscountStore, Game } from '@/shared/types';
import { EpicIcon, GOGIcon, SteamIcon } from '../Icons/BrandIcons';

interface DiscountStoreView {
  name: string;
  Icon: React.ComponentType<{ size?: number }>;
  pageOf: (game: Game) => string | null;
  // GOG Galaxy has no verified link to a store page, so GOG opens in the browser
  open: (url: string) => Promise<unknown>;
}

export const DISCOUNT_STORES: Record<DiscountStore, DiscountStoreView> = {
  steam: {
    name: 'Steam',
    Icon: SteamIcon,
    pageOf: (game) =>
      game.steam_app_id === null ? null : steamStoreUrl(game.steam_app_id),
    open: (url) => window.electronAPI.openAppLink('steam', url),
  },
  gog: {
    name: 'GOG',
    Icon: GOGIcon,
    pageOf: (game) => game.gog_store_url,
    open: (url) => window.electronAPI.openExternal(url),
  },
  egs: {
    name: 'Epic Games',
    Icon: EpicIcon,
    pageOf: (game) => game.epic_store_url,
    open: (url) => window.electronAPI.openAppLink('epic', url),
  },
};
