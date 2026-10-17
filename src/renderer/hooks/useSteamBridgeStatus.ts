import { useEffect } from 'react';
import type { SteamBridgeStatus } from '@/shared/types';
import { useSteamBridgeStatusStore } from '../store/useSteamBridgeStatusStore';

interface UseSteamBridgeStatusResult {
  status: SteamBridgeStatus | null;
  recheck: () => Promise<SteamBridgeStatus | null>;
}

export function useSteamBridgeStatus(enabled = true): UseSteamBridgeStatusResult {
  const status = useSteamBridgeStatusStore((s) => s.status);
  const recheck = useSteamBridgeStatusStore((s) => s.recheck);

  useEffect(() => {
    if (enabled && window.electronAPI) {
      void useSteamBridgeStatusStore.getState().refresh();
    }
  }, [enabled]);

  return { status, recheck };
}
