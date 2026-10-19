import { useEffect } from 'react';
import { t } from '@/shared/i18n/i18n';
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
        title: t('steamRestartPrompt.title'),
        message: t('steamRestartPrompt.message'),
        type: 'info',
        actions: [
          {
            label: t('steamRestartPrompt.restartAction'),
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
