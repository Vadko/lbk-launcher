import { createJSONStorage } from 'zustand/middleware';
import type { SerializedMap, SerializedSet, PersistedSubscriptionsState, GameProgress } from './types';

/**
 * Custom storage with Map/Set serialization
 */
export const customStorage = createJSONStorage<PersistedSubscriptionsState>(() => localStorage, {
  reviver: (_key, value: unknown) => {
    if (value && typeof value === 'object' && '__type' in value) {
      const typed = value as SerializedMap | SerializedSet;
      if (typed.__type === 'Map') {
        return new Map(typed.data);
      }
      if (typed.__type === 'Set') {
        return new Set(typed.data);
      }
    }
    return value;
  },
  replacer: (_key, value: unknown) => {
    if (value instanceof Map) {
      return { __type: 'Map', data: Array.from(value.entries()) } as SerializedMap;
    }
    if (value instanceof Set) {
      return { __type: 'Set', data: Array.from(value) } as SerializedSet;
    }
    return value;
  },
});

/**
 * Type guard for Set
 */
export function isValidSet<T>(value: unknown): value is Set<T> {
  return value instanceof Set;
}

/**
 * Type guard for Map
 */
export function isValidMap<K, V>(value: unknown): value is Map<K, V> {
  return value instanceof Map;
}

/**
 * Safely get or create Set instance
 */
export function ensureSet<T>(value: unknown): Set<T> {
  if (isValidSet<T>(value)) {
    return new Set(value);
  }
  console.warn('[SubscriptionsStore] Converting invalid Set to new Set');
  return new Set(Array.isArray(value) ? value : []);
}

/**
 * Safely get or create Map instance
 */
export function ensureMap<K, V>(value: unknown): Map<K, V> {
  if (isValidMap<K, V>(value)) {
    return new Map(value);
  }
  console.warn('[SubscriptionsStore] Converting invalid Map to new Map');
  if (Array.isArray(value)) {
    return new Map(value as [K, V][]);
  }
  if (value && typeof value === 'object') {
    return new Map(Object.entries(value) as [K, V][]);
  }
  return new Map();
}

/**
 * Migrate old data formats to new Set/Map structures
 */
export function migrateStoreData(state: Partial<PersistedSubscriptionsState>): void {
  let migrated = false;

  if (!isValidSet(state.subscribedGames)) {
    console.warn('[SubscriptionsStore] Migrating subscribedGames to Set');
    state.subscribedGames = ensureSet<string>(state.subscribedGames);
    migrated = true;
  }

  if (!isValidSet(state.subscribedTeams)) {
    console.warn('[SubscriptionsStore] Migrating subscribedTeams to Set');
    state.subscribedTeams = ensureSet<string>(state.subscribedTeams);
    migrated = true;
  }

  if (!isValidSet(state.promptedGamesForSubscription)) {
    console.warn('[SubscriptionsStore] Migrating promptedGamesForSubscription to Set');
    state.promptedGamesForSubscription = ensureSet<string>(state.promptedGamesForSubscription);
    migrated = true;
  }

  if (!isValidMap(state.subscribedGameStatuses)) {
    console.warn('[SubscriptionsStore] Migrating subscribedGameStatuses to Map');
    state.subscribedGameStatuses = ensureMap<string, string>(state.subscribedGameStatuses);
    migrated = true;
  }

  if (!isValidMap(state.subscribedGameProgress)) {
    console.warn('[SubscriptionsStore] Migrating subscribedGameProgress to Map');
    state.subscribedGameProgress = ensureMap<string, GameProgress>(state.subscribedGameProgress);
    migrated = true;
  }

  if (migrated) {
    console.log('[SubscriptionsStore] Migration completed', {
      subscribedGamesCount: state.subscribedGames?.size ?? 0,
      subscribedTeamsCount: state.subscribedTeams?.size ?? 0,
      promptedGamesCount: state.promptedGamesForSubscription?.size ?? 0,
      subscribedGameStatusesCount: state.subscribedGameStatuses?.size ?? 0,
      subscribedGameProgressCount: state.subscribedGameProgress?.size ?? 0,
    });
  }
}
