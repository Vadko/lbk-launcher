import { ipcRenderer } from 'electron';
import type { RatingsAPI } from '../shared/ratings-api-types';

export const ratingsAPI: RatingsAPI = {
  fetchTeamsRating: (hideAi) => ipcRenderer.invoke('ratings:teams', hideAi),
  fetchGamesRating: (hideAi) => ipcRenderer.invoke('ratings:games', hideAi),
};
