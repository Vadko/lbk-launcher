import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * Drives the "tombstone" state of a game page:
 * - returns `isTombstoned` (removed from the catalog but installed locally)
 * - updates reactively through the 'game-tombstoned' event
 * - if the game is actually gone from the local DB (via sync/realtime/post-uninstall) —
 *   redirects home so stale data is never shown
 */
export function useGameTombstone(gameId: string | undefined): boolean {
  const navigate = useNavigate();
  const [data, setData] = useState<{ id: string; value: boolean } | null>(null);

  useEffect(() => {
    if (!window.electronAPI?.onGameRemoved || !gameId) {
      return;
    }
    const unsubscribe = window.electronAPI.onGameRemoved((removedId) => {
      if (removedId === gameId) {
        console.log('[useGameTombstone] Current game removed, navigating home');
        navigate('/');
      }
    });
    return unsubscribe;
  }, [gameId, navigate]);

  useEffect(() => {
    if (!gameId) {
      return;
    }
    let cancelled = false;
    window.electronAPI
      ?.isGameTombstoned(gameId)
      .then((value) => {
        if (!cancelled) {
          setData({ id: gameId, value });
        }
      })
      .catch((err) => console.error('[useGameTombstone] check failed:', err));

    const unsubscribe = window.electronAPI?.onGameTombstoned?.((tombstonedId) => {
      if (tombstonedId === gameId) {
        setData({ id: gameId, value: true });
      }
    });
    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [gameId]);

  return data !== null && data.id === gameId ? data.value : false;
}
