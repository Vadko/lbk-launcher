import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { gameLink } from '../utils/gameLink';

// A click on a system notification shown from the tray; GamePage loads the game itself
export function useNavigateFromNotifications() {
  const navigate = useNavigate();

  useEffect(() => {
    if (!window.windowControls?.onNavigateToGame) {
      return;
    }

    return window.windowControls.onNavigateToGame((target) => {
      console.log('[App] Navigating to game from notification:', target.gameId);
      navigate(gameLink(target));
    });
  }, [navigate]);
}
