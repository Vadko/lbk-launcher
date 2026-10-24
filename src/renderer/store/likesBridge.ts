import { useLikesStore } from './useLikesStore';

export function initLikes(): void {
  const api = window.electronAPI;
  if (!api?.onLikedGamesChanged) {
    return;
  }

  const { setLikedGameIds } = useLikesStore.getState();
  api.onLikedGamesChanged(setLikedGameIds);
  void api.getLikedGameIds().then(setLikedGameIds);
}
