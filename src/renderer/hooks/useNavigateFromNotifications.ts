import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * Hook for handling navigation from system notifications.
 * Listens for events from the main process and navigates to the target game.
 */
export function useNavigateFromNotifications() {
  const navigate = useNavigate();

  useEffect(() => {
    if (!window.windowControls?.onNavigateToGame) {
      return;
    }

    const unsubscribe = window.windowControls.onNavigateToGame((gameId) => {
      console.log('[App] Navigating to game from notification:', gameId);
      // Just navigate - GamePage will load the game itself if needed
      navigate(`/game/${gameId}`);
    });

    return unsubscribe;
  }, [navigate]);
}
