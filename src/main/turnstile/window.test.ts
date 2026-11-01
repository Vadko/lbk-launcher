import type { EventEmitter } from 'node:events';
import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from 'vitest';
import { CAPTCHA_CHANNELS } from '../../shared/captcha-channels';
import type * as CaptchaWindow from './window';

interface Frame {
  origin: string;
  parent: object | null;
}

interface FakeContents extends EventEmitter {
  ipc: EventEmitter;
  send: Mock;
  openHandler: (() => unknown) | null;
}

interface FakeWindow extends EventEmitter {
  options: { show: boolean; webPreferences: Record<string, unknown> };
  webContents: FakeContents;
  loadURL: Mock;
  isDestroyed: () => boolean;
}

const PAGE = new URL('https://lbklauncher.com/captcha');
const ID = '3d2c1b0a-9f8e-4d7c-8b6a-5f4e3d2c1b0a';

const state = vi.hoisted(() => ({
  windows: [] as FakeWindow[],
  session: { name: 'captcha-session' },
  reportCaptchaFault: vi.fn(),
}));

vi.mock('electron', async () => {
  const { EventEmitter } = await import('node:events');
  class BrowserWindow extends EventEmitter {
    destroyed = false;
    readonly loadURL = vi.fn(() => Promise.resolve());
    readonly webContents: FakeContents = Object.assign(new EventEmitter(), {
      ipc: new EventEmitter(),
      send: vi.fn(),
      openHandler: null,
      setWindowOpenHandler: (handler: () => unknown) => {
        this.webContents.openHandler = handler;
      },
    });

    constructor(readonly options: FakeWindow['options']) {
      super();
      state.windows.push(this);
    }

    isDestroyed = () => this.destroyed;

    destroy() {
      if (!this.destroyed) {
        this.destroyed = true;
        this.emit('closed');
      }
    }
  }
  return { app: { getAppPath: () => '/app', isPackaged: true }, BrowserWindow };
});
vi.mock('@/main/turnstile/session', () => ({ captchaSession: () => state.session }));
vi.mock('@/main/turnstile/report-captcha-fault', () => ({
  reportCaptchaFault: state.reportCaptchaFault,
}));

const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);

let captcha: typeof CaptchaWindow;
const listener = { answer: vi.fn(), lost: vi.fn() };

function lastWindow(): FakeWindow {
  const window = state.windows.at(-1);
  if (!window) {
    throw new Error('no captcha window was made');
  }
  return window;
}

function fromPage(
  channel: string,
  args: unknown[],
  frame: Frame | null = { origin: PAGE.origin, parent: null },
  window = lastWindow()
): void {
  window.webContents.ipc.emit(
    channel,
    { sender: window.webContents, senderFrame: frame },
    ...args
  );
}

async function openReady() {
  const ready = captcha.openCaptchaPage(PAGE, listener);
  fromPage(CAPTCHA_CHANNELS.ready, []);
  const send = await ready;
  if (!send) {
    throw new Error('the captcha page did not get ready');
  }
  return send;
}

beforeEach(async () => {
  vi.useFakeTimers();
  state.windows = [];
  listener.answer.mockReset();
  listener.lost.mockReset();
  state.reportCaptchaFault.mockReset();
  log.mockClear();
  warn.mockClear();
  error.mockClear();
  vi.resetModules();
  captcha = await import('./window');
});

afterEach(() => {
  vi.useRealTimers();
});

describe('openCaptchaPage', () => {
  it('makes no window before the first request', () => {
    expect(state.windows).toEqual([]);
  });

  it('makes one locked-down hidden window and reuses it', async () => {
    await openReady();
    await captcha.openCaptchaPage(PAGE, listener);

    expect(state.windows).toHaveLength(1);
    const { options, loadURL } = lastWindow();
    expect(options.show).toBe(false);
    expect(options.webPreferences).toMatchObject({
      preload: expect.stringMatching(/out[\\/]preload[\\/]turnstile\.js$/),
      session: state.session,
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true,
      backgroundThrottling: false,
    });
    expect(loadURL).toHaveBeenCalledWith(PAGE.href);
  });

  it('sends requests to the page once it is ready', async () => {
    const send = await openReady();
    const request = { requestId: ID, action: 'reply' as const, cData: 'abc' };

    send(request);
    expect(lastWindow().webContents.send).toHaveBeenCalledWith(
      CAPTCHA_CHANNELS.request,
      request
    );
  });

  it('hands the answers to the listener', async () => {
    await openReady();
    fromPage(CAPTCHA_CHANNELS.resolve, [ID, 'token-1']);
    fromPage(CAPTCHA_CHANNELS.reject, [ID, '300030']);

    expect(listener.answer.mock.calls).toEqual([
      [{ type: 'resolve', requestId: ID, token: 'token-1' }],
      [{ type: 'reject', requestId: ID, code: '300030' }],
    ]);
  });

  it.each([
    ['another origin', { origin: 'https://challenges.cloudflare.com', parent: null }],
    ['a subframe', { origin: PAGE.origin, parent: {} }],
    ['a frame gone after a navigation', null],
  ])('ignores a message from %s', async (_label, frame) => {
    await openReady();
    fromPage(CAPTCHA_CHANNELS.resolve, [ID, 'token-1'], frame);

    expect(listener.answer).not.toHaveBeenCalled();
  });

  it('ignores a message sent from another window', async () => {
    await openReady();
    const window = lastWindow();
    window.webContents.ipc.emit(
      CAPTCHA_CHANNELS.resolve,
      { sender: {}, senderFrame: { origin: PAGE.origin, parent: null } },
      ID,
      'token-1'
    );

    expect(listener.answer).not.toHaveBeenCalled();
  });

  it('ignores a malformed answer', async () => {
    await openReady();
    fromPage(CAPTCHA_CHANNELS.resolve, [ID, 42]);

    expect(listener.answer).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith(
      `[Turnstile] Ignored a malformed ${CAPTCHA_CHANNELS.resolve}`
    );
  });

  it('waits for a ready from the page itself', async () => {
    const ready = captcha.openCaptchaPage(PAGE, listener);
    fromPage(CAPTCHA_CHANNELS.ready, [], { origin: 'https://example.com', parent: null });

    expect(await Promise.race([ready, Promise.resolve('pending')])).toBe('pending');
    fromPage(CAPTCHA_CHANNELS.ready, []);
    expect(await ready).toEqual(expect.any(Function));
  });

  it.each<[string, (window: FakeWindow) => void]>([
    [
      'an HTTP error page',
      (window) =>
        window.webContents.emit('did-navigate', {}, PAGE.href, 404, 'Not Found'),
    ],
    [
      'a failed load',
      (window) =>
        window.webContents.emit(
          'did-fail-load',
          {},
          -106,
          'ERR_INTERNET_DISCONNECTED',
          PAGE.href,
          true
        ),
    ],
    [
      'a crashed renderer',
      (window) =>
        window.webContents.emit('render-process-gone', {}, { reason: 'crashed' }),
    ],
    [
      'a page without Turnstile',
      () => fromPage(CAPTCHA_CHANNELS.unavailable, ['script_error']),
    ],
  ])('gives up on %s and makes a new window next time', async (_label, fail) => {
    const ready = captcha.openCaptchaPage(PAGE, listener);
    const window = lastWindow();
    fail(window);

    expect(await ready).toBeNull();
    expect(window.isDestroyed()).toBe(true);
    expect(listener.lost).toHaveBeenCalledTimes(1);
    void captcha.openCaptchaPage(PAGE, listener);
    expect(state.windows).toHaveLength(2);
  });

  it.each<[string, () => void]>([
    [
      'HTTP 503',
      () => lastWindow().webContents.emit('did-navigate', {}, PAGE.href, 503, ''),
    ],
    [
      'page reported script_error',
      () => fromPage(CAPTCHA_CHANNELS.unavailable, ['script_error']),
    ],
  ])('reports %s as the landing fault it is', async (reason, fail) => {
    const ready = captcha.openCaptchaPage(PAGE, listener);
    fail();
    await ready;

    expect(state.reportCaptchaFault.mock.calls).toEqual([[`window closed: ${reason}`]]);
  });

  it.each<[string, () => void]>([
    [
      'an offline load',
      () =>
        lastWindow().webContents.emit(
          'did-fail-load',
          {},
          -106,
          'ERR_INTERNET_DISCONNECTED',
          PAGE.href,
          true
        ),
    ],
    [
      'a crashed renderer',
      () =>
        lastWindow().webContents.emit('render-process-gone', {}, { reason: 'crashed' }),
    ],
    ['an idle window', () => vi.advanceTimersByTime(3 * 60_000)],
  ])('reports nothing for %s', (_label, end) => {
    void captcha.openCaptchaPage(PAGE, listener);
    fromPage(CAPTCHA_CHANNELS.ready, []);
    end();

    expect(lastWindow().isDestroyed()).toBe(true);
    expect(error).not.toHaveBeenCalled();
    expect(state.reportCaptchaFault).not.toHaveBeenCalled();
  });

  it('waits for a slow page instead of closing it', async () => {
    const ready = captcha.openCaptchaPage(PAGE, listener);
    vi.advanceTimersByTime(60_000);
    fromPage(CAPTCHA_CHANNELS.ready, []);

    expect(await ready).toEqual(expect.any(Function));
    expect(lastWindow().isDestroyed()).toBe(false);
  });

  it("leaves a failed load of Turnstile's own frame alone", async () => {
    const ready = captcha.openCaptchaPage(PAGE, listener);
    lastWindow().webContents.emit('did-fail-load', {}, -3, '', 'about:srcdoc', false);
    fromPage(CAPTCHA_CHANNELS.ready, []);

    expect(await ready).toEqual(expect.any(Function));
  });
});

describe('navigation', () => {
  const navigate = (event: string, url: string, isMainFrame = true) => {
    const details = { url, isMainFrame, preventDefault: vi.fn() };
    lastWindow().webContents.emit(event, details);
    return details.preventDefault;
  };

  beforeEach(() => {
    void captcha.openCaptchaPage(PAGE, listener);
  });

  it.each([
    ['will-navigate', 'https://example.com/', true],
    ['will-navigate', 'https://lbklauncher.com.example/captcha', true],
    ['will-navigate', 'https://lbklauncher.com/other', false],
    ['will-redirect', 'https://www.example.com/captcha', true],
    ['will-redirect', 'https://lbklauncher.com/captcha', false],
  ])('%s to %s is blocked: %s', (event, url, blocked) => {
    expect(navigate(event, url).mock.calls.length > 0).toBe(blocked);
  });

  it.each([
    'https://challenges.cloudflare.com/cdn-cgi/challenge-platform/x',
    'about:srcdoc',
  ])("lets Turnstile's frame go to %s", (url) => {
    expect(navigate('will-redirect', url, false)).not.toHaveBeenCalled();
  });

  it('refuses every popup', () => {
    expect(lastWindow().webContents.openHandler?.()).toEqual({ action: 'deny' });
  });
});

describe('lifetime', () => {
  it('closes after 3 min without a request', async () => {
    await openReady();
    vi.advanceTimersByTime(3 * 60_000 - 1);
    expect(lastWindow().isDestroyed()).toBe(false);

    vi.advanceTimersByTime(1);

    expect(lastWindow().isDestroyed()).toBe(true);
    expect(listener.lost).toHaveBeenCalledTimes(1);
  });

  it('counts the idle time from the last request', async () => {
    const send = await openReady();
    vi.advanceTimersByTime(2 * 60_000);
    send({ requestId: ID, action: 'review', cData: 'abc' });
    vi.advanceTimersByTime(2 * 60_000);

    expect(lastWindow().isDestroyed()).toBe(false);
  });

  it('is destroyed on demand, any number of times', async () => {
    await openReady();
    captcha.destroyCaptchaWindow();
    captcha.destroyCaptchaWindow();

    expect(lastWindow().isDestroyed()).toBe(true);
    expect(listener.lost).toHaveBeenCalledTimes(1);
  });

  it('settles a page still loading when it is destroyed', async () => {
    const ready = captcha.openCaptchaPage(PAGE, listener);
    captcha.destroyCaptchaWindow();

    expect(await ready).toBeNull();
  });

  it('makes no window after the app starts quitting', async () => {
    await openReady();
    captcha.stopCaptchaWindow();
    captcha.stopCaptchaWindow();

    expect(await captcha.openCaptchaPage(PAGE, listener)).toBeNull();
    expect(state.windows).toHaveLength(1);
    expect(lastWindow().isDestroyed()).toBe(true);
  });

  it('forgets a window closed from outside', async () => {
    await openReady();
    lastWindow().emit('closed');
    void captcha.openCaptchaPage(PAGE, listener);

    expect(state.windows).toHaveLength(2);
  });
});
