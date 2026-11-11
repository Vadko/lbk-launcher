import { appEvents } from '@/main/app-events';
import { changeLanguage } from '@/shared/i18n/i18n';
import { refreshTrayMenu } from './ipc/window-controls';
import { IS_E2E } from './tracking';
import { readLanguage } from './utils/store-storage';

async function applyStoredLanguage(): Promise<void> {
  await changeLanguage(readLanguage());
  refreshTrayMenu();
}

export async function startLanguage(): Promise<void> {
  // E2E finds its text by uk keys, so a language saved on the developer's machine must not apply.
  if (IS_E2E) {
    return;
  }
  appEvents.on('language-changed', applyStoredLanguage);
  await applyStoredLanguage().catch((error: unknown) => {
    console.error('[Main] Failed to apply the saved language:', error);
  });
}
