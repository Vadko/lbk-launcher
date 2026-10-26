import type { Game } from '../../shared/types';

export function orderWeeklyPickGames(gameIds: string[], games: Game[]): Game[] {
  const byId = new Map(games.map((game) => [game.id, game]));
  const seen = new Set<string>();

  return gameIds.flatMap((id) => {
    const game = byId.get(id);
    if (!game || seen.has(id)) {
      return [];
    }
    seen.add(id);
    return [game];
  });
}
