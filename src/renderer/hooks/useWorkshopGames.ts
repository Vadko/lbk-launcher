import { useCallback, useEffect, useRef, useState } from 'react';
import type { WorkshopGame } from '../../shared/types';
import { useStore } from '../store/useStore';

interface UseWorkshopGamesResult {
  games: WorkshopGame[];
  isLoading: boolean;
  error: string | null;
  reload: () => void;
}

/**
 * Завантажити Steam Workshop переклади. Спрощена версія useGames.ts -
 * без special filters (favorites/installed/платформи), бо Workshop-переклади
 * не пов'язані з основним каталогом і не "встановлюються" цим лаунчером.
 */
export function useWorkshopGames(searchQuery = ''): UseWorkshopGamesResult {
  const syncStatus = useStore((s) => s.syncStatus);
  const [games, setGames] = useState<WorkshopGame[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const loadWorkshopGames = useCallback(async () => {
    if (!window.electronAPI) {
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setIsLoading(true);
    setError(null);

    try {
      const result = await window.electronAPI.fetchWorkshopGames({ searchQuery });
      if (controller.signal.aborted) {
        return;
      }
      setGames(result.games);
    } catch (err) {
      if (controller.signal.aborted) {
        return;
      }
      console.error('[useWorkshopGames] Failed to fetch workshop games:', err);
      setError(err instanceof Error ? err.message : 'Failed to load workshop games');
    } finally {
      if (!controller.signal.aborted) {
        setIsLoading(false);
      }
    }
  }, [searchQuery]);

  useEffect(() => {
    if (syncStatus === 'ready' || syncStatus === 'error') {
      loadWorkshopGames();
    }
    return () => {
      abortRef.current?.abort();
    };
  }, [loadWorkshopGames, syncStatus]);

  return { games, isLoading, error, reload: loadWorkshopGames };
}
