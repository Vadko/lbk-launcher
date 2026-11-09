import type { SteamBridgeStatus } from '@/shared/plugin-host-types';
import { useRefreshedResource } from './useRefreshedResource';

interface UseSteamBridgeStatusResult {
  status: SteamBridgeStatus | null;
  recheck: () => Promise<SteamBridgeStatus | null>;
}

const recheck = () =>
  window.electronAPI.recheckSteamBridge().catch((error: unknown) => {
    console.warn('[SteamBridgeStatus] Recheck failed:', error);
    return null;
  });

export function useSteamBridgeStatus(enabled = true): UseSteamBridgeStatusResult {
  const status = useRefreshedResource('steamBridgeStatus', enabled).value ?? null;
  return { status, recheck };
}
