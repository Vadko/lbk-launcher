import { useEffect } from 'react';
import { useSteamBridgeStatusStore } from '../store/useSteamBridgeStatusStore';
import { useSteamPluginHostStore } from '../store/useSteamPluginHostStore';
import { useIdleEffect } from './useIdleEffect';

export function useSteamBridgeStatusSync(): void {
  useEffect(() => {
    const api = window.electronAPI;
    if (!api?.onSteamBridgeStatusChanged) {
      return;
    }
    const bridge = useSteamBridgeStatusStore.getState();
    const unsubscribers = [
      api.onSteamBridgeStatusChanged(bridge.setStatus),
      // Main also republishes after a batch; a refetch covers a publish that compared equal.
      api.onSteamPendingActionsApplied(() => {
        void bridge.refresh();
      }),
      api.onPluginHostStateChanged(useSteamPluginHostStore.getState().setState),
    ];
    return () => {
      for (const unsubscribe of unsubscribers) {
        unsubscribe();
      }
    };
  }, []);

  useIdleEffect(() => {
    if (window.electronAPI) {
      void useSteamBridgeStatusStore.getState().refresh();
    }
  }, []);
}
