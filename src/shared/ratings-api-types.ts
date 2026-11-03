import type { Game } from './types';

export interface TeamRatingItem {
  name: string;
  likes: number;
  translations: number;
  downloads: number;
}

export interface GameRatingItem {
  id: string;
  name: string;
  likes: number;
  downloads: number;
  status: Game['status'];
}

export interface RatingsAPI {
  fetchTeamsRating: (hideAi: boolean) => Promise<TeamRatingItem[] | null>;
  fetchGamesRating: (hideAi: boolean) => Promise<GameRatingItem[] | null>;
}
