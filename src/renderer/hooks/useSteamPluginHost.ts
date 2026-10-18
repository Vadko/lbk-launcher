import { useCallback, useEffect, useState } from 'react';
import type { PluginHostState } from '@/shared/plugin-host-types';

interface UseSteamPluginHostResult {
  state: PluginHostState | null;
  refresh: () => Promise<PluginHostState | null>;
}

export function useSteamPluginHost(enabled = true): UseSteamPluginHostResult {
  const [state, setState] = useState<PluginHostState | null>(null);

  useEffect(() => {
    const api = window.electronAPI;
    if (!enabled || !api?.getPluginHostState) {
      return;
    }
    let active = true;
    const unsubscribe = api.onPluginHostStateChanged((next) => {
      if (active) {
        setState(next);
      }
    });
    api
      .getPluginHostState()
      .then((next) => {
        if (active && next) {
          setState(next);
        }
      })
      .catch((error: unknown) => {
        console.warn('[useSteamPluginHost] State fetch failed:', error);
      });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [enabled]);

  const refresh = useCallback(async () => {
    try {
      const next = await window.electronAPI.getPluginHostState();
      if (next) {
        setState(next);
      }
      return next;
    } catch (error) {
      console.warn('[useSteamPluginHost] Refresh failed:', error);
      return null;
    }
  }, []);

  return { state, refresh };
}
