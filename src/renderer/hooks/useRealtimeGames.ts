import { useEffect } from 'react';
import { useStore } from '../store/useStore';
import type { Game } from '../types/game';

/**
 * Hook for subscribing to real-time game updates
 * Updates selectedGame and checks for updates for installed games
 * The Supabase subscription is managed automatically in the main process
 */
export function useRealtimeGames() {
  const { selectedGame, setSelectedGame } = useStore();

  useEffect(() => {
    if (!window.electronAPI) {
      return;
    }

    // Game update handler
    const handleGameUpdate = (updatedGame: Game) => {
      console.log('[useRealtimeGames] Game updated via real-time:', updatedGame.name);

      // Update selectedGame if it's the same game
      if (selectedGame && selectedGame.id === updatedGame.id) {
        console.log('[useRealtimeGames] Updating selectedGame in store');
        setSelectedGame(updatedGame);
      }

      // Notifications about version updates and status changes are handled in useGames.ts
    };

    // Subscribe to updates
    console.log('[useRealtimeGames] Subscribing to game updates');
    const unsubscribe = window.electronAPI.onGameUpdated(handleGameUpdate);
    return unsubscribe;
  }, [selectedGame, setSelectedGame]);
}
