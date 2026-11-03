import type { Game } from './types';

export interface RatingsPageInput {
  offset: number;
  limit: number;
  hideAi: boolean;
}

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
  fetchTeamsRating: (input: RatingsPageInput) => Promise<TeamRatingItem[] | null>;
  fetchGamesRating: (input: RatingsPageInput) => Promise<GameRatingItem[] | null>;
}
