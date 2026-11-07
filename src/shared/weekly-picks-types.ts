import type { Game } from './types';

export interface WeeklyPicks {
  title: string | null;
  games: readonly Game[];
}

export interface WeeklyPicksRead {
  picks: WeeklyPicks | null;
}

export interface WeeklyPicksAPI {
  // null when the read failed, which keeps the set already shown
  getWeeklyPicks: (hideAiTranslations: boolean) => Promise<WeeklyPicksRead | null>;
  onWeeklyPicksUpdated: (callback: () => void) => () => void;
}
