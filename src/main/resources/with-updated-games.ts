import type { Game } from '@/shared/types';

// A list untouched by the pushed rows keeps its identity, so the resource holding it sends nothing
export function withUpdatedGames(
  games: readonly Game[],
  updated: readonly Game[]
): readonly Game[] {
  const byId = new Map(updated.map((game) => [game.id, game]));
  return games.some((game) => byId.has(game.id))
    ? games.map((game) => byId.get(game.id) ?? game)
    : games;
}

export function gamesWithCounters<V extends { games: readonly Game[] } | null>(
  value: V,
  updated: readonly Game[]
): V {
  if (value === null) {
    return value;
  }
  const games = withUpdatedGames(value.games, updated);
  return games === value.games ? value : { ...value, games };
}
