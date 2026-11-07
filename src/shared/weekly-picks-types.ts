import type { Game } from './types';

export interface WeeklyPicks {
  title: string | null;
  games: readonly Game[];
}

export interface WeeklyPicksAPI {
  getWeeklyPicks: (hideAiTranslations: boolean) => Promise<WeeklyPicks | null>;
  onWeeklyPicksUpdated: (callback: () => void) => () => void;
}
