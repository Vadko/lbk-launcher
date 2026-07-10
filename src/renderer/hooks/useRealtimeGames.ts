import { useEffect } from 'react';
import { useStore } from '../store/useStore';
import type { Game } from '../types/game';

/**
 * Хук для підписки на real-time оновлення ігор
 * Оновлює selectedGame та перевіряє наявність оновлень для встановлених ігор
 * Підписка на Supabase керується автоматично в main process
 */
export function useRealtimeGames() {
  const { selectedGame, setSelectedGame } = useStore();

  useEffect(() => {
    if (!window.electronAPI) {
      return;
    }

    // Обробник оновлень гри
    const handleGameUpdate = (updatedGame: Game) => {
      console.log('[useRealtimeGames] Game updated via real-time:', updatedGame.name);

      // Оновити selectedGame якщо це та сама гра
      if (selectedGame && selectedGame.id === updatedGame.id) {
        console.log('[useRealtimeGames] Updating selectedGame in store');
        setSelectedGame(updatedGame);
      }

      // Нотифікації про оновлення версій та зміни статусів обробляються в useGames.ts
    };

    // Підписатися на оновлення
    console.log('[useRealtimeGames] Subscribing to game updates');
    const unsubscribe = window.electronAPI.onGameUpdated(handleGameUpdate);
    return unsubscribe;
  }, [selectedGame, setSelectedGame]);
}
