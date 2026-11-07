import type { ResourceMap } from '@/shared/resources';
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

export function homeInstalledWithCounters(
  value: ResourceMap['homeInstalled'],
  updated: readonly Game[]
): ResourceMap['homeInstalled'] {
  const games = withUpdatedGames(value.games, updated);
  return games === value.games ? value : { ...value, games };
}

export function weeklyPicksWithCounters(
  picks: ResourceMap['weeklyPicks'],
  updated: readonly Game[]
): ResourceMap['weeklyPicks'] {
  const games = picks && withUpdatedGames(picks.games, updated);
  return picks && games && games !== picks.games ? { ...picks, games } : picks;
}
