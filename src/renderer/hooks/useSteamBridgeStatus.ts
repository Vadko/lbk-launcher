import { useCallback, useEffect, useState } from 'react';
import type { SteamBridgeStatus } from '@/shared/types';

interface UseSteamBridgeStatusResult {
  status: SteamBridgeStatus | null;
  recheck: () => Promise<SteamBridgeStatus | null>;
}

export function useSteamBridgeStatus(enabled = true): UseSteamBridgeStatusResult {
  const [status, setStatus] = useState<SteamBridgeStatus | null>(null);

  useEffect(() => {
    const api = window.electronAPI;
    if (!enabled || !api?.getSteamBridgeStatus) {
      return;
    }
    let active = true;
    const refresh = () => {
      api
        .getSteamBridgeStatus()
        .then((next) => {
          if (active && next) {
            setStatus(next);
          }
        })
        .catch((error: unknown) => {
          console.warn('[useSteamBridgeStatus] Status fetch failed:', error);
        });
    };

    const unsubscribeStatus = api.onSteamBridgeStatusChanged((next) => {
      if (active) {
        setStatus(next);
      }
    });
    // Main also republishes after a batch; a refetch covers a publish that compared equal.
    const unsubscribeApplied = api.onSteamPendingActionsApplied(refresh);
    refresh();

    return () => {
      active = false;
      unsubscribeStatus();
      unsubscribeApplied();
    };
  }, [enabled]);

  const recheck = useCallback(async () => {
    try {
      const next = await window.electronAPI.recheckSteamBridge();
      if (next) {
        setStatus(next);
      }
      return next;
    } catch (error) {
      console.warn('[useSteamBridgeStatus] Recheck failed:', error);
      return null;
    }
  }, []);

  return { status, recheck };
}
