import { useEffect } from 'react';
import type { SteamBridgeStatus } from '@/shared/plugin-host-types';
import { useResource } from './useResource';

interface UseSteamBridgeStatusResult {
  status: SteamBridgeStatus | null;
  recheck: () => Promise<SteamBridgeStatus | null>;
}

const recheck = () =>
  window.electronAPI.recheckSteamBridge().catch((error: unknown) => {
    console.warn('[SteamBridgeStatus] Recheck failed:', error);
    return null;
  });

// Shows the last pushed status at once; main publishes what a revalidation reads
export function useSteamBridgeStatus(enabled = true): UseSteamBridgeStatusResult {
  const status = useResource('steamBridgeStatus') ?? null;

  useEffect(() => {
    if (enabled) {
      window.electronAPI.getSteamBridgeStatus().catch((error: unknown) => {
        console.warn('[SteamBridgeStatus] Status fetch failed:', error);
      });
    }
  }, [enabled]);

  return { status, recheck };
}
