import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * Керує "tombstone" станом сторінки гри:
 * - повертає `isTombstoned` (видалено з каталогу, але встановлено локально)
 * - реактивно оновлюється через 'game-tombstoned' event
 * - якщо гру дефакто видалили з локальної БД (через sync/realtime/post-uninstall) —
 *   перенаправляє на головну, щоб не показувати stale дані
 */
export function useGameTombstone(gameId: string | undefined): boolean {
  const navigate = useNavigate();
  const [isTombstoned, setIsTombstoned] = useState(false);

  useEffect(() => {
    if (!window.electronAPI?.onGameRemoved || !gameId) return;
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
      setIsTombstoned(false);
      return;
    }
    let cancelled = false;
    window.electronAPI
      ?.isGameTombstoned(gameId)
      .then((value) => {
        if (!cancelled) setIsTombstoned(value);
      })
      .catch((err) => console.error('[useGameTombstone] check failed:', err));

    const unsubscribe = window.electronAPI?.onGameTombstoned?.((tombstonedId) => {
      if (tombstonedId === gameId) setIsTombstoned(true);
    });
    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [gameId]);

  return isTombstoned;
}
