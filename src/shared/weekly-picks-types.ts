import type { Game } from './types';

export interface WeeklyPicks {
  title: string | null;
  games: readonly Game[];
}
