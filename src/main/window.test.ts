import type { EventEmitter } from 'node:events';
import { describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  window: null as EventEmitter | null,
  destroyCaptchaWindow: vi.fn(),
}));

vi.mock('electron', async () => {
  const { EventEmitter } = await import('node:events');
  class BrowserWindow extends EventEmitter {
    readonly webContents = Object.assign(new EventEmitter(), {
      setWindowOpenHandler: vi.fn(),
    });

    constructor() {
      super();
      state.window = this;
    }

    isDestroyed = () => false;
    show = vi.fn();
  }
  return {
    app: { getAppPath: () => '/app', isPackaged: true },
    BrowserWindow,
    ipcMain: { handle: vi.fn() },
    nativeTheme: {},
  };
});
vi.mock('@sentry/electron/main', () => ({ captureMessage: vi.fn() }));
vi.mock('@/lib/electron-router-dom', () => ({ registerRoute: vi.fn() }));
vi.mock('@/main/liquid-glass', () => ({
  applyLiquidGlass: vi.fn(),
  isLiquidGlassSupported: () => false,
  removeLiquidGlass: vi.fn(),
}));
vi.mock('@/main/turnstile/window', () => ({
  destroyCaptchaWindow: state.destroyCaptchaWindow,
}));
vi.mock('@/main/utils/open-external', () => ({ openExternalUrl: vi.fn() }));
vi.mock('@/main/utils/platform', () => ({
  isLinux: () => false,
  isMacOS: () => false,
  supportsMacOSLiquidGlass: () => false,
}));
vi.mock('@/main/utils/store-storage', () => ({ readRendererSetting: vi.fn() }));
vi.mock('@/main/utils/theme', () => ({ getIcon: vi.fn() }));

vi.spyOn(console, 'log').mockImplementation(() => undefined);

const { createMainWindow } = await import('./window');

describe('createMainWindow', () => {
  // A hidden captcha window left alive would keep Windows and Linux from quitting
  it('destroys the captcha window as soon as the main window closes', async () => {
    vi.useFakeTimers();
    await createMainWindow();

    state.window?.emit('closed');

    expect(state.destroyCaptchaWindow).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });
});
