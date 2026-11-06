import { A, O } from '@mobily/ts-belt';
import type { Game } from '../../shared/types';

export function orderWeeklyPickGames(
  gameIds: readonly string[],
  games: readonly Game[]
): readonly Game[] {
  const byId = new Map(games.map((game) => [game.id, game]));
  return A.filterMap(gameIds, (id) => O.fromNullable(byId.get(id)));
}
