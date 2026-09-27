import { useEffect } from 'react';
import { useStore } from '../store/useStore';
import type { Game } from '../types/game';

/**
 * Хук для підписки на real-time оновлення ігор
 * Оновлює selectedGame та перевіряє наявність оновлень для встановлених ігор
 * Підписка на Supabase керується автоматично в main process
 */
export function useRealtimeGames() {
  useEffect(() => {
    if (!window.electronAPI) {
      return;
    }

    const handleGameUpdate = (updatedGame: Game) => {
      console.log('[useRealtimeGames] Game updated via real-time:', updatedGame.name);
      useStore.getState().syncSelectedGame(updatedGame);

      // Нотифікації про оновлення версій та зміни статусів обробляються в useGames.ts
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
