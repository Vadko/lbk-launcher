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
  homeInstalled: { games: readonly Game[]; installedPathsCount: number };
  weeklyPicks: WeeklyPicks | null;
  // Both by translation rating: at least 70 downloads, and added in the last 21 days with fewer
  popularGames: readonly Game[];
  newStarGames: readonly Game[];
  steamBridgeStatus: SteamBridgeStatus;
  pluginHostState: PluginHostState;
}

export type ResourceKey = keyof ResourceMap;

// values holds what changed; failed names every key whose last read failed, which keeps its last value
export interface ResourceUpdate {
  values: Partial<ResourceMap>;
  failed: ReadonlySet<ResourceKey>;
}

// Main reads each key once more; a page sends its keys as it wants them
export interface ResourceSubscribe {
  subscribe: ResourceKey[];
}

// The preload makes a MessageChannel: main gets one end, the page the other, and main opens with a snapshot of everything held
export const RESOURCES_CHANNEL = 'resources:connect';

export interface ResourcesAPI {
  connectResources: () => void;
}
