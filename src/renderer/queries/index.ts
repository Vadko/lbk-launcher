// Query client
export { queryClient } from './queryClient';

// Trending games
export {
  type TrendingGameData,
  type TrendingGameWithDetails,
  trendingKeys,
  useTrendingGames,
  useTrendingGamesList,
} from './useTrendingGames';

// Placements
export {
  placementKeys,
  usePlacements,
  FALLBACK_PLACEMENTS,
} from './usePlacements';
