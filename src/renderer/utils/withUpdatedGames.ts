import type { Game } from '../../shared/types';

// A list untouched by the pushed rows keeps its identity, so its subscribers do not re-render
export function withUpdatedGames(
  games: readonly Game[],
  updated: readonly Game[]
): readonly Game[] {
  const byId = new Map(updated.map((game) => [game.id, game]));
  return games.some((game) => byId.has(game.id))
    ? games.map((game) => byId.get(game.id) ?? game)
    : games;
}
