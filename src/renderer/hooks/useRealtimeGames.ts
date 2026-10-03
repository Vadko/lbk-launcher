import { useEffect } from 'react';
import { useStore } from '../store/useStore';
import type { Game } from '../types/game';

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
      (game: Game) => {
        useStore.getState().syncSelectedGame(game);
      }
    );
    return () => {
      unsubscribe();
      unsubscribeCounters?.();
    };
  }, []);
}
