import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { type DeepLinkTarget, REVIEWS_TAB } from '@/shared/game-link-target';
import { useStore } from '../store/useStore';

const isCatalogReady = () => {
  const { syncStatus } = useStore.getState();
  return syncStatus === 'ready' || syncStatus === 'error';
};

// A link can be what launched LBK, while the first sync still leaves the catalog empty
const whenCatalogReady = () =>
  new Promise<void>((resolve) => {
    if (isCatalogReady()) {
      resolve();
      return;
    }
    const unsubscribe = useStore.subscribe(() => {
      if (isCatalogReady()) {
        unsubscribe();
        resolve();
      }
    });
  });

// lbk://games/{slug}/{team}, with ?tab=reviews for the reviews tab
export function useDeepLink() {
  const navigate = useNavigate();

  useEffect(() => {
    if (!window.electronAPI?.onDeepLink) {
      return;
    }

    const handleDeepLink = async (data: DeepLinkTarget) => {
      try {
        await whenCatalogReady();
        const gameId = await window.electronAPI.findDeepLinkGameId(data.slug, data.team);
        if (gameId) {
          navigate(
            data.openReviews ? `/game/${gameId}?tab=${REVIEWS_TAB}` : `/game/${gameId}`
          );
        } else {
          console.warn('[DeepLink] Game not found for:', data);
        }
      } catch (error) {
        console.error('[DeepLink] Error handling deep link:', error);
      }
    };

    const unsubscribe = window.electronAPI.onDeepLink(handleDeepLink);
    window.electronAPI.notifyReady?.();
    return unsubscribe;
  }, [navigate]);
}
