import { en } from '@lbk/i18n/en';
import { pl } from '@lbk/i18n/pl';
import { uk } from '@lbk/i18n/uk';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { appEvents } from '@/main/app-events';
import { changeLanguage, t } from '@/shared/i18n/i18n';
import type { Language } from '@/shared/i18n/languages';

const mocks = vi.hoisted(() => ({
  stored: 'uk' as Language,
  e2e: false,
  refreshTrayMenu: vi.fn(),
}));

vi.mock('./ipc/window-controls', () => ({ refreshTrayMenu: mocks.refreshTrayMenu }));
vi.mock('./utils/store-storage', () => ({ readLanguage: () => mocks.stored }));
vi.mock('./tracking', () => ({
  get IS_E2E() {
    return mocks.e2e;
  },
}));

const { startLanguage } = await import('./language');

beforeEach(() => {
  mocks.stored = 'uk';
  mocks.e2e = false;
  mocks.refreshTrayMenu.mockReset();
});

afterEach(async () => {
  appEvents.removeAllListeners('language-changed');
  await changeLanguage('uk');
});

describe('startLanguage', () => {
  it('applies the stored language and rebuilds the tray', async () => {
    mocks.stored = 'en';

    await startLanguage();

    expect(t('tray.open')).toBe(en.tray.open);
    expect(mocks.refreshTrayMenu).toHaveBeenCalledOnce();
  });

  it('applies a later change and rebuilds the tray again', async () => {
    await startLanguage();
    mocks.stored = 'pl';

    appEvents.emit('language-changed');

    await vi.waitFor(() => expect(mocks.refreshTrayMenu).toHaveBeenCalledTimes(2));
    expect(t('tray.open')).toBe(pl.tray.open);
  });

  it('keeps uk under E2E whatever is stored', async () => {
    mocks.e2e = true;
    mocks.stored = 'en';

    await startLanguage();
    appEvents.emit('language-changed');

    expect([t('tray.open'), appEvents.listenerCount('language-changed')]).toEqual([
      uk.tray.open,
      0,
    ]);
    expect(mocks.refreshTrayMenu).not.toHaveBeenCalled();
  });
});
