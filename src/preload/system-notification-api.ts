import type { SystemNotificationAPI } from '../shared/game-link-target';
import { invoke, listen } from './ipc';

export const systemNotificationAPI: SystemNotificationAPI = {
  showSystemNotification: invoke('show-system-notification'),
  onNavigateToGame: listen('navigate-to-game'),
};
