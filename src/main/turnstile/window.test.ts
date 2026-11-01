import type { EventEmitter } from 'node:events';
import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from 'vitest';
import type * as CaptchaWindow from './window';

interface FakeContents extends EventEmitter {
  executeJavaScript: Mock<(code: string) => Promise<unknown>>;
  openHandler: (() => unknown) | null;
}

interface FakeWindow extends EventEmitter {
  options: { show: boolean; webPreferences: Record<string, unknown> };
  webContents: FakeContents;
  loadURL: Mock;
  isDestroyed: () => boolean;
}

const PAGE = new URL('https://lbklauncher.com/captcha');
const CDATA = 'a1b2c3';

const state = vi.hoisted(() => ({
  windows: [] as FakeWindow[],
  session: { name: 'captcha-session' },
  // One per executeJavaScript call, settled by the test as the page would
  runs: [] as Array<PromiseWithResolvers<unknown>>,
  reportCaptchaFault: vi.fn(),
}));

vi.mock('electron', async () => {
  const { EventEmitter } = await import('node:events');
  class BrowserWindow extends EventEmitter {
    destroyed = false;
    readonly loadURL = vi.fn(() => Promise.resolve());
    readonly webContents: FakeContents = Object.assign(new EventEmitter(), {
      executeJavaScript: vi.fn(() => {
        const run = Promise.withResolvers<unknown>();
        state.runs.push(run);
        return run.promise;
      }),
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

const flush = () => vi.advanceTimersByTimeAsync(0);

function lastWindow(): FakeWindow {
  const window = state.windows.at(-1);
  if (!window) {
    throw new Error('no captcha window was made');
  }
  return window;
}

function lastRun(): PromiseWithResolvers<unknown> {
  const run = state.runs.at(-1);
  if (!run) {
    throw new Error('the page was not asked to solve');
  }
  return run;
}

const load = (window = lastWindow()) => window.webContents.emit('did-finish-load');

// A solve on a loaded page, answered as the page would
async function solved(answer: unknown) {
  const solving = captcha.solveCaptcha(PAGE, 'reply', CDATA);
  load();
  await flush();
  lastRun().resolve(answer);
  return solving;
}

beforeEach(async () => {
  vi.useFakeTimers();
  state.windows = [];
  state.runs = [];
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

describe('solveCaptcha', () => {
  it('makes no window before the first solve', () => {
    expect(state.windows).toEqual([]);
  });

  it('makes one locked-down hidden window without a preload and reuses it', async () => {
    await solved({ token: 'token-1' });
    const second = captcha.solveCaptcha(PAGE, 'edit', CDATA);
    await flush();
    lastRun().resolve({ token: 'token-2' });

    expect(await second).toEqual({ token: 'token-2' });
    expect(state.windows).toHaveLength(1);
    const { options, loadURL } = lastWindow();
    expect(options.show).toBe(false);
    expect(options.webPreferences).not.toHaveProperty('preload');
    expect(options.webPreferences).toMatchObject({
      session: state.session,
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true,
      backgroundThrottling: false,
    });
    expect(loadURL).toHaveBeenCalledWith(PAGE.href);
  });

  it("calls the page's solver once the page has loaded", async () => {
    const solving = captcha.solveCaptcha(PAGE, 'reply', CDATA);
    await flush();
    const { executeJavaScript } = lastWindow().webContents;
    expect(executeJavaScript).not.toHaveBeenCalled();

    load();
    await flush();
    expect(executeJavaScript).toHaveBeenCalledWith(
      `window.lbkCaptcha.solve("reply", "${CDATA}")`
    );
    lastRun().resolve({ token: 'token-1' });

    expect(await solving).toEqual({ token: 'token-1' });
  });

  it("hands back the challenge's error and keeps the page", async () => {
    expect(await solved({ error: '300030' })).toEqual({ error: '300030' });
    expect(lastWindow().isDestroyed()).toBe(false);
    expect(state.reportCaptchaFault).not.toHaveBeenCalled();
  });

  it.each<[string, (run: PromiseWithResolvers<unknown>) => void, string]>([
    ['a malformed answer', (run) => run.resolve({ token: 42 }), 'malformed answer'],
    [
      'a page without a solver',
      (run) => run.reject(new Error('Script failed to execute')),
      'solve threw: Script failed to execute',
    ],
    [
      'a page that could not load Turnstile',
      (run) => run.resolve({ error: 'script_error' }),
      'page reported script_error',
    ],
  ])(
    'closes on %s, reports it and makes a new window next time',
    async (_label, answer, reason) => {
      const solving = captcha.solveCaptcha(PAGE, 'reply', CDATA);
      load();
      await flush();
      answer(lastRun());

      expect(await solving).toBeNull();
      expect(lastWindow().isDestroyed()).toBe(true);
      expect(state.reportCaptchaFault.mock.calls).toEqual([[`window closed: ${reason}`]]);
      void captcha.solveCaptcha(PAGE, 'reply', CDATA);
      expect(state.windows).toHaveLength(2);
    }
  );

  it('ends a solve in flight when the window goes', async () => {
    const solving = captcha.solveCaptcha(PAGE, 'reply', CDATA);
    load();
    await flush();
    captcha.destroyCaptchaWindow();

    expect(await solving).toBeNull();
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
  ])('gives up on %s and makes a new window next time', async (_label, fail) => {
    const solving = captcha.solveCaptcha(PAGE, 'reply', CDATA);
    const window = lastWindow();
    fail(window);
    load(window);

    expect(await solving).toBeNull();
    expect(window.isDestroyed()).toBe(true);
    expect(window.webContents.executeJavaScript).not.toHaveBeenCalled();
    void captcha.solveCaptcha(PAGE, 'reply', CDATA);
    expect(state.windows).toHaveLength(2);
  });

  it('reports HTTP 503 as the landing fault it is', async () => {
    const solving = captcha.solveCaptcha(PAGE, 'reply', CDATA);
    lastWindow().webContents.emit('did-navigate', {}, PAGE.href, 503, '');
    await solving;

    expect(state.reportCaptchaFault.mock.calls).toEqual([['window closed: HTTP 503']]);
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
    void captcha.solveCaptcha(PAGE, 'reply', CDATA);
    load();
    end();

    expect(lastWindow().isDestroyed()).toBe(true);
    expect(error).not.toHaveBeenCalled();
    expect(state.reportCaptchaFault).not.toHaveBeenCalled();
  });

  it('waits for a slow page instead of closing it', async () => {
    const solving = captcha.solveCaptcha(PAGE, 'reply', CDATA);
    await vi.advanceTimersByTimeAsync(60_000);
    load();
    await flush();
    lastRun().resolve({ token: 'token-1' });

    expect(await solving).toEqual({ token: 'token-1' });
    expect(lastWindow().isDestroyed()).toBe(false);
  });

  it("leaves a failed load of Turnstile's own frame alone", async () => {
    const solving = captcha.solveCaptcha(PAGE, 'reply', CDATA);
    lastWindow().webContents.emit('did-fail-load', {}, -3, '', 'about:srcdoc', false);
    load();
    await flush();
    lastRun().resolve({ token: 'token-1' });

    expect(await solving).toEqual({ token: 'token-1' });
  });
});

describe('navigation', () => {
  const navigate = (event: string, url: string, isMainFrame = true) => {
    const details = { url, isMainFrame, preventDefault: vi.fn() };
    lastWindow().webContents.emit(event, details);
    return details.preventDefault;
  };

  beforeEach(() => {
    void captcha.solveCaptcha(PAGE, 'reply', CDATA);
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
  it('closes after 3 min without a solve', async () => {
    await solved({ token: 'token-1' });
    vi.advanceTimersByTime(3 * 60_000 - 1);
    expect(lastWindow().isDestroyed()).toBe(false);

    vi.advanceTimersByTime(1);

    expect(lastWindow().isDestroyed()).toBe(true);
  });

  it('counts the idle time from the last solve', async () => {
    await solved({ token: 'token-1' });
    vi.advanceTimersByTime(2 * 60_000);
    void captcha.solveCaptcha(PAGE, 'review', CDATA);
    vi.advanceTimersByTime(2 * 60_000);

    expect(lastWindow().isDestroyed()).toBe(false);
  });

  it('is destroyed on demand, any number of times', async () => {
    await solved({ token: 'token-1' });
    captcha.destroyCaptchaWindow();
    captcha.destroyCaptchaWindow();

    expect(lastWindow().isDestroyed()).toBe(true);
    expect(log).toHaveBeenCalledOnce();
  });

  it('settles a page still loading when it is destroyed', async () => {
    const solving = captcha.solveCaptcha(PAGE, 'reply', CDATA);
    captcha.destroyCaptchaWindow();

    expect(await solving).toBeNull();
  });

  it('makes no window after the app starts quitting', async () => {
    await solved({ token: 'token-1' });
    captcha.stopCaptchaWindow();
    captcha.stopCaptchaWindow();

    expect(await captcha.solveCaptcha(PAGE, 'reply', CDATA)).toBeNull();
    expect(state.windows).toHaveLength(1);
    expect(lastWindow().isDestroyed()).toBe(true);
  });

  it('forgets a window closed from outside', async () => {
    await solved({ token: 'token-1' });
    lastWindow().emit('closed');
    void captcha.solveCaptcha(PAGE, 'reply', CDATA);

    expect(state.windows).toHaveLength(2);
  });
});
