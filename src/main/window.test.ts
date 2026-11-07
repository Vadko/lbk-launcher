import type { EventEmitter } from 'node:events';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type FakeWindow = EventEmitter & { webContents: EventEmitter };

const state = vi.hoisted(() => ({
  window: null as FakeWindow | null,
  destroyCaptchaWindow: vi.fn(),
  stopReviewEvents: vi.fn(),
  send: vi.fn(),
}));

vi.mock('electron', async () => {
  const { EventEmitter } = await import('node:events');
  class BrowserWindow extends EventEmitter {
    readonly webContents = Object.assign(new EventEmitter(), {
      setWindowOpenHandler: vi.fn(),
      send: state.send,
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
vi.mock('@/main/review-events', () => ({ stopReviewEvents: state.stopReviewEvents }));
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
vi.spyOn(console, 'error').mockImplementation(() => undefined);

const { createMainWindow, markPageReady, sendToReadyPage } = await import('./window');

const navigation = (isSameDocument: boolean) => ({ isMainFrame: true, isSameDocument });

beforeEach(async () => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  await createMainWindow();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('createMainWindow', () => {
  // A hidden captcha window left alive would keep Windows and Linux from quitting
  it('destroys the captcha window as soon as the main window closes', () => {
    state.window?.emit('closed');

    expect(state.destroyCaptchaWindow).toHaveBeenCalledTimes(1);
  });

  it.each<[string, (window: FakeWindow) => void]>([
    [
      'a reload',
      (window) => window.webContents.emit('did-start-navigation', navigation(false)),
    ],
    [
      'a crashed page',
      (window) =>
        window.webContents.emit('render-process-gone', {}, { reason: 'clean-exit' }),
    ],
    ['a closed window', (window) => window.emit('closed')],
  ])('stops review events on %s', (_label, end) => {
    if (state.window) {
      end(state.window);
    }

    expect(state.stopReviewEvents).toHaveBeenCalledTimes(1);
  });

  it('keeps review events across a navigation inside the page', () => {
    state.window?.webContents.emit('did-start-navigation', navigation(true));

    expect(state.stopReviewEvents).not.toHaveBeenCalled();
  });
});

describe('sendToReadyPage', () => {
  const target = { gameId: 'g1' };

  it('holds a push until the page says it is ready', () => {
    sendToReadyPage('navigate-to-game', target);

    expect(state.send).not.toHaveBeenCalled();
    markPageReady();
    expect(state.send.mock.calls).toEqual([['navigate-to-game', target]]);
  });

  it('sends the latest held push of a channel, once', () => {
    sendToReadyPage('navigate-to-game', { gameId: 'old' });
    sendToReadyPage('navigate-to-game', target);

    markPageReady();
    markPageReady();

    expect(state.send.mock.calls).toEqual([['navigate-to-game', target]]);
  });

  it('sends at once to a ready page, across a navigation inside it', () => {
    markPageReady();
    state.window?.webContents.emit('did-start-navigation', navigation(true));

    sendToReadyPage('navigate-to-game', target);

    expect(state.send.mock.calls).toEqual([['navigate-to-game', target]]);
  });

  it.each<[string, (window: FakeWindow) => void]>([
    [
      'a reload',
      (window) => window.webContents.emit('did-start-navigation', navigation(false)),
    ],
    [
      'a crashed page',
      (window) =>
        window.webContents.emit('render-process-gone', {}, { reason: 'clean-exit' }),
    ],
  ])('holds a push again after %s, until the new page is ready', (_label, end) => {
    markPageReady();
    if (state.window) {
      end(state.window);
    }

    sendToReadyPage('navigate-to-game', target);

    expect(state.send).not.toHaveBeenCalled();
    markPageReady();
    expect(state.send.mock.calls).toEqual([['navigate-to-game', target]]);
  });

  // macOS keeps running without a window, and a notification click opens a new one
  it('holds a click for the window it recreates after the last one closed', async () => {
    markPageReady();
    state.window?.emit('closed');
    await createMainWindow();

    sendToReadyPage('navigate-to-game', target);

    expect(state.send).not.toHaveBeenCalled();
    markPageReady();
    expect(state.send.mock.calls).toEqual([['navigate-to-game', target]]);
  });
});
