export interface WeeklyPicks {
  title: string | null;
  startsAt: string;
  expiresAt: string;
  gameIds: string[];
}

export interface WeeklyPicksAPI {
  fetchWeeklyPicks: () => Promise<WeeklyPicks | null>;
}
