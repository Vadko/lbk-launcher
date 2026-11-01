import { ipcRenderer } from 'electron';
import type {
  GameLinkTarget,
  SystemNotificationAPI,
  SystemNotificationOptions,
} from '../shared/game-link-target';

export const systemNotificationAPI: SystemNotificationAPI = {
  showSystemNotification: (options: SystemNotificationOptions) =>
    ipcRenderer.invoke('show-system-notification', options),
  onNavigateToGame: (callback: (target: GameLinkTarget) => void) => {
    const handler = (_: unknown, target: GameLinkTarget) => callback(target);
    ipcRenderer.on('navigate-to-game', handler);
    return () => ipcRenderer.removeListener('navigate-to-game', handler);
  },
};
