import type { PluginHostState, SteamBridgeStatus } from './plugin-host-types';
import type { GameRatingItem, TeamRatingItem } from './ratings-types';
import type {
  FacetRow,
  Game,
  LibraryMemberships,
  StoreDiscount,
  TagOption,
} from './types';
import type { WeeklyPicks } from './weekly-picks-types';

// State main owns and pushes to the main window; the port's structured clone keeps Map and Set
export interface ResourceMap {
  facetRows: FacetRow[];
  catalogOptions: { teams: string[]; tags: TagOption[] };
  libraries: LibraryMemberships;
  installedTranslationIds: ReadonlySet<string>;
  ratings: { teams: TeamRatingItem[]; games: GameRatingItem[] };
  // Per Steam app id, the biggest discount first; games in the player's library of that store are left out
  storeDiscounts: ReadonlyMap<number, StoreDiscount[]>;
  likedGameIds: ReadonlySet<string>;
  homeInstalled: { games: Game[]; installedPathsCount: number };
  weeklyPicks: WeeklyPicks | null;
  steamBridgeStatus: SteamBridgeStatus;
  pluginHostState: PluginHostState;
}

export type ResourceKey = keyof ResourceMap;

// satisfies makes a key missing here, or one ResourceMap does not have, a compile error
const KEYS = {
  facetRows: true,
  catalogOptions: true,
  libraries: true,
  installedTranslationIds: true,
  ratings: true,
  storeDiscounts: true,
  likedGameIds: true,
  homeInstalled: true,
  weeklyPicks: true,
  steamBridgeStatus: true,
  pluginHostState: true,
} satisfies Record<ResourceKey, true>;

export const isResourceKey = (value: unknown): value is ResourceKey =>
  typeof value === 'string' && Object.hasOwn(KEYS, value);

// A key in values is read again, so it is no longer failed; a failed key keeps its last value
export interface ResourceUpdate {
  values: Partial<ResourceMap>;
  failed: ResourceKey[];
}

export interface ResourceSubscribe {
  subscribe: ResourceKey[];
}

export const RESOURCES_CONNECT_CHANNEL = 'resources:connect';
export const RESOURCES_PORT_CHANNEL = 'resources:port';

export interface ResourcesAPI {
  connectResources: () => void;
}
