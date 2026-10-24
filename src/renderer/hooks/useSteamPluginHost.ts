import { useEffect } from 'react';
import type { PluginHostState } from '@/shared/plugin-host-types';
import { useSteamPluginHostStore } from '../store/useSteamPluginHostStore';

export function useSteamPluginHost(enabled = true): PluginHostState | null {
  const state = useSteamPluginHostStore((s) => s.state);

  useEffect(() => {
    if (enabled && window.electronAPI) {
      void useSteamPluginHostStore.getState().refresh();
    }
  }, [enabled]);

  return state;
}
