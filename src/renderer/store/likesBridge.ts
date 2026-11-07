import { useLikesStore } from './useLikesStore';
import { useResourcesStore } from './useResourcesStore';

// The likes store lays clicks main has not answered yet over the set main sends
export function initLikes(): void {
  useResourcesStore.subscribe((state, prev) => {
    const liked = state.values.likedGameIds;
    if (liked && liked !== prev.values.likedGameIds) {
      useLikesStore.getState().setLikedGameIds(liked);
    }
  });
}
