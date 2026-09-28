import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * Hook for handling deep link navigation.
 * Listens for deep-link events from the main process and navigates to the target translation.
 * URL format: lbk://games/{slug}/{team}
 */
export function useDeepLink() {
  const navigate = useNavigate();

  useEffect(() => {
    if (!window.electronAPI?.onDeepLink) {
      return;
    }

    const handleDeepLink = async (data: { slug: string; team: string }) => {
      console.log('[DeepLink] Navigating to:', data);

      try {
        // TODO: Optimize - currently loads ALL games to find one
        // Options: 1) add an API method to search by slug, 2) use a cache
        const result = await window.electronAPI.fetchGames();

        // Find the game by slug and team
        const targetGame = result.games.find((game) => {
          const gameSlug = game.slug || game.id;
          const slugMatch = gameSlug === data.slug;

          // Check team (can be comma-separated or an exact match)
          const teamMatch =
            game.team?.toLowerCase() === data.team.toLowerCase() ||
            game.team
              ?.toLowerCase()
              .split(',')
              .map((t) => t.trim())
              .includes(data.team.toLowerCase());

          return slugMatch && teamMatch;
        });

        if (targetGame) {
          console.log('[DeepLink] Found game:', targetGame.name, 'by', targetGame.team);
          navigate(`/game/${targetGame.id}`);
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
