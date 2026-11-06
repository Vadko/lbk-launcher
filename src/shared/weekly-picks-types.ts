interface WeeklyPicks {
  title: string | null;
  gameIds: string[];
}

export type WeeklyPicksResult =
  | { success: true; picks: WeeklyPicks | null }
  | { success: false; error: string };

export interface WeeklyPicksAPI {
  fetchWeeklyPicks: () => Promise<WeeklyPicksResult>;
}
