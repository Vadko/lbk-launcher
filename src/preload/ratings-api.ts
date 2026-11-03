import { ipcRenderer } from 'electron';
import type { RatingsAPI } from '../shared/ratings-api-types';

export const ratingsAPI: RatingsAPI = {
  fetchTeamsRating: (input) => ipcRenderer.invoke('ratings:teams', input),
  fetchGamesRating: (input) => ipcRenderer.invoke('ratings:games', input),
};
