import { useEffect } from 'react';
import { useModalStore } from '../store/useModalStore';
import { runSteamRestart } from '../utils/steamBridge';

// Sent only by the Settings toggle, at most once per bridge fingerprint.
export function useSteamRestartPrompt(): void {
  useEffect(() => {
    if (!window.electronAPI?.onSteamRestartRequired) {
      return;
    }
    return window.electronAPI.onSteamRestartRequired(() => {
      useModalStore.getState().showModal({
        title: 'Перезапустіть Steam',
        message:
          'Щоб зміни набули чинності, потрібно перезапустити Steam. ' +
          'Можна зробити це пізніше — налаштування вже збережено.',
        type: 'info',
        actions: [
          {
            label: 'Перезапустити Steam',
            onClick: () => {
              void runSteamRestart(() => window.electronAPI.restartSteam(), {
                launchOptions: false,
              });
            },
            keepOpen: true,
            variant: 'primary',
          },
        ],
      });
    });
  }, []);
}
