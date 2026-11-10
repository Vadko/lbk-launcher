import { appEvents } from '@/main/app-events';
import { setLanguage } from '@/shared/i18n/i18n';
import { refreshTrayMenu } from './ipc/window-controls';
import { readLanguage } from './utils/store-storage';

export function startLanguage(): void {
  setLanguage(readLanguage());
  appEvents.on('language-changed', () => {
    setLanguage(readLanguage());
    refreshTrayMenu();
  });
}
