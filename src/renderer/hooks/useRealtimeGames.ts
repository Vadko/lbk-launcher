import { useEffect } from 'react';
import type { Game } from '../../shared/types';
import { useStore } from '../store/useStore';

/**
 * Hook for subscribing to real-time game updates
 * Updates selectedGame and checks for updates for installed games
 * The Supabase subscription is managed automatically in the main process
 */
export function useRealtimeGames() {
  useEffect(() => {
    if (!window.electronAPI) {
      return;
    }

    const handleGameUpdate = (updatedGame: Game) => {
      console.log('[useRealtimeGames] Game updated via real-time:', updatedGame.name);
      useStore.getState().syncSelectedGame(updatedGame);

      // Notifications about version updates and status changes are handled in useGames.ts
    };

    console.log('[useRealtimeGames] Subscribing to game updates');
    const unsubscribe = window.electronAPI.onGameUpdated(handleGameUpdate);
    const unsubscribeCounters = window.electronAPI.onGameCountersUpdated?.(
      (games: Game[]) => {
        const { selectedGame, syncSelectedGame } = useStore.getState();
        const updated = games.find((game) => game.id === selectedGame?.id);
        if (updated) {
          syncSelectedGame(updated);
        }
      }
    );
    return () => {
      unsubscribe();
      unsubscribeCounters?.();
    };
  }, []);
}
