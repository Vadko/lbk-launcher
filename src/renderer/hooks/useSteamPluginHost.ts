import { useEffect } from 'react';
import type { PluginHostState } from '@/shared/plugin-host-types';
import { useResource } from './useResource';

// Shows the last pushed state at once; main publishes what a revalidation reads
export function useSteamPluginHost(enabled = true): PluginHostState | null {
  const state = useResource('pluginHostState') ?? null;

  useEffect(() => {
    if (enabled) {
      window.electronAPI.getPluginHostState().catch((error: unknown) => {
        console.warn('[SteamPluginHost] State fetch failed:', error);
      });
    }
  }, [enabled]);

  return state;
}
