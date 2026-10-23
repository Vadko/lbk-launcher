export interface HomePicks {
  title: string | null;
  startsAt: string;
  expiresAt: string;
  gameIds: string[];
}

export interface HomePicksAPI {
  fetchHomePicks: () => Promise<HomePicks | null>;
}
