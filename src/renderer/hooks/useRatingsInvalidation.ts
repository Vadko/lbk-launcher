import { F } from '@mobily/ts-belt';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { ratingsKey } from '../queries/ratingsKey';

const RELOAD_DEBOUNCE_MS = 300;

export function useRatingsInvalidation() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const reload = F.makeControlledDebounce(
      () => void queryClient.invalidateQueries({ queryKey: ratingsKey }),
      { delay: RELOAD_DEBOUNCE_MS, leading: false }
    );
    const unsubscribers = [
      window.electronAPI.onGameCountersUpdated(() => reload.schedule()),
      window.electronAPI.onGameUpdated(() => reload.schedule()),
      window.electronAPI.onGameRemoved(() => reload.schedule()),
    ];
    return () => {
      reload.cancel();
      unsubscribers.forEach((unsubscribe) => unsubscribe());
    };
  }, [queryClient]);
}
