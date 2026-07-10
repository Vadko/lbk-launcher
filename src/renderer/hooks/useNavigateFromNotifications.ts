import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * Hook для обробки навігації з системних нотифікацій.
 * Слухає події від main process і навігує до потрібної гри.
 */
export function useNavigateFromNotifications() {
  const navigate = useNavigate();

  useEffect(() => {
    if (!window.windowControls?.onNavigateToGame) {
      return;
    }

    const unsubscribe = window.windowControls.onNavigateToGame((gameId) => {
      console.log('[App] Navigating to game from notification:', gameId);
      // Просто навігуємо - GamePage сам завантажить гру якщо потрібно
      navigate(`/game/${gameId}`);
    });

    return unsubscribe;
  }, [navigate]);
}
