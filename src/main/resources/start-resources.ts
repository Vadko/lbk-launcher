import { D } from '@mobily/ts-belt';
import { GamesRepository } from '@/main/db/games-repository';
import { getGamesRating, getTeamsRating } from '@/main/db/ratings-queries';
import { getWeeklyPicks } from '@/main/db/weekly-picks';
import { getHomeInstalledGames } from '@/main/home-installed-games';
import { getLocallyInstalledGameIds } from '@/main/installer/cache';
import { getLibraryMemberships } from '@/main/library-memberships';
import { getLikedGameIds } from '@/main/likes';
import { getPluginHostState } from '@/main/plugin-host/state';
import { getStoreDiscountsByApp } from '@/main/store-discounts-by-app';
import { getSteamBridgeStatus } from '@/main/utils/steam-bridge';
import { readHideAiTranslations } from '@/main/utils/store-storage';
import type { ResourceKey } from '@/shared/resources';
import {
  defineResource,
  type Resource,
  type ResourceDefinition,
} from './define-resource';
import { setupResourcePort } from './resource-port';
import { gamesWithCounters } from './with-updated-games';

const repo = () => GamesRepository.getInstance();

const DEFINITIONS: { [K in ResourceKey]: ResourceDefinition<K> } = {
  facetRows: {
    read: () => repo().getFacetRows(),
    on: ['catalog-changed'],
    afterCatalogSync: true,
  },
  catalogOptions: {
    read: () => ({ teams: repo().getUniqueAuthors(), tags: repo().getTagOptions() }),
    on: ['catalog-changed'],
    afterCatalogSync: true,
  },
  // A catalog change can give a game the app id or install folder its library match needs
  libraries: {
    read: getLibraryMemberships,
    on: ['library-changed', 'installs-changed', 'catalog-changed'],
    afterCatalogSync: true,
  },
  installedTranslationIds: {
    read: getLocallyInstalledGameIds,
    on: ['installs-changed', 'workshop-installs-changed'],
  },
  ratings: {
    read: () => {
      const hideAi = readHideAiTranslations();
      return { teams: getTeamsRating(hideAi), games: getGamesRating(hideAi) };
    },
    on: ['counters-changed', 'catalog-changed', 'hide-ai-changed'],
    afterCatalogSync: true,
  },
  // The table and last run's catalog are read at once; any catalog change can change the GOG and Epic title matches
  storeDiscounts: {
    read: getStoreDiscountsByApp,
    on: ['store-discounts-changed', 'library-changed', 'catalog-changed', 'sync-status'],
  },
  likedGameIds: {
    read: () => new Set(getLikedGameIds()),
    on: ['likes-changed'],
  },
  // A read rescans every store library, so new counters are patched in
  homeInstalled: {
    read: () => getHomeInstalledGames(readHideAiTranslations()),
    on: ['catalog-changed', 'library-changed', 'hide-ai-changed'],
    afterCatalogSync: true,
    withCounters: gamesWithCounters,
  },
  // The set's order does not follow the counters, so the pushed rows are enough
  weeklyPicks: {
    read: () => getWeeklyPicks(readHideAiTranslations()),
    on: ['weekly-picks-changed', 'catalog-changed', 'hide-ai-changed'],
    afterCatalogSync: true,
    withCounters: gamesWithCounters,
  },
  // Their owners publish every value they compute; the page's subscribe reads it once more
  steamBridgeStatus: { read: getSteamBridgeStatus, on: [] },
  // steamRunning and canRestartSteam follow Steam, which the owner does not republish for
  pluginHostState: { read: getPluginHostState, on: ['steam-started', 'steam-exited'] },
};

const define = <K extends ResourceKey>(key: K): Resource =>
  defineResource(key, DEFINITIONS[key]);

export function startResources(): void {
  const resources = D.mapWithKey(DEFINITIONS, define);
  setupResourcePort((key) => resources[key].wanted());
}
