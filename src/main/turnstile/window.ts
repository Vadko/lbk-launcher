import { join } from 'node:path';
import { F } from '@mobily/ts-belt';
import { app, BrowserWindow } from 'electron';
import { CAPTCHA_CHANNELS } from '../../shared/captcha-channels';
import { type CaptchaRequest, PAGE_MESSAGES, type PageMessage } from './contract';
import { reportCaptchaFault } from './report-captcha-fault';
import { isFromCaptchaPage } from './sender';
import { captchaSession } from './session';

const READY_TIMEOUT_MS = 15_000;
const IDLE_MS = 3 * 60_000;

type CaptchaAnswer = Extract<PageMessage, { type: 'resolve' | 'reject' }>;

// False once the page that took the request is gone
type SendRequest = (request: CaptchaRequest) => boolean;

export interface CaptchaPageListener {
  answer: (answer: CaptchaAnswer) => void;
  // Every request still open dies with the page
  lost: () => void;
}

type CloseLog = 'log' | 'warn' | 'error';

interface CaptchaPage {
  window: BrowserWindow;
  ready: Promise<SendRequest | null>;
  close: (log: CloseLog, reason: string) => void;
}

let page: CaptchaPage | null = null;
let quitting = false;

const idle = F.makeControlledDebounce(() => page?.close('log', 'idle'), {
  delay: IDLE_MS,
  leading: false,
});

function newWindow(): BrowserWindow {
  return new BrowserWindow({
    show: false,
    skipTaskbar: true,
    webPreferences: {
      preload: join(app.getAppPath(), 'out/preload/turnstile.js'),
      session: captchaSession(),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true,
      // Turnstile runs on timers, which Chromium throttles in a hidden window
      backgroundThrottling: false,
      spellcheck: false,
      devTools: !app.isPackaged,
    },
  });
}

function lockDown(window: BrowserWindow, origin: string): void {
  const contents = window.webContents;
  const isPageOrigin = (target: string) =>
    URL.canParse(target) && new URL(target).origin === origin;
  contents.on('will-navigate', (details) => {
    if (!isPageOrigin(details.url)) {
      details.preventDefault();
    }
  });
  // Turnstile's frames load challenges.cloudflare.com, about:blank and about:srcdoc, so only the top frame is held
  contents.on('will-redirect', (details) => {
    if (details.isMainFrame && !isPageOrigin(details.url)) {
      details.preventDefault();
    }
  });
  contents.on('will-attach-webview', (event) => {
    event.preventDefault();
  });
  contents.setWindowOpenHandler(() => ({ action: 'deny' }));
}

function createPage(url: URL, listener: CaptchaPageListener): CaptchaPage {
  const window = newWindow();
  const contents = window.webContents;
  let closed = false;
  let settleReady: (send: SendRequest | null) => void = () => undefined;
  const ready = new Promise<SendRequest | null>((resolve) => {
    settleReady = resolve;
  });
  const readyTimer = setTimeout(
    () => close('error', 'not ready in time'),
    READY_TIMEOUT_MS
  );

  const close = (log: CloseLog, reason: string) => {
    if (closed) {
      return;
    }
    closed = true;
    console[log](`[Turnstile] Captcha window closed: ${reason}`);
    // An error is a landing fault that stops every public write, so it has to reach Sentry
    if (log === 'error') {
      reportCaptchaFault(reason);
    }
    clearTimeout(readyTimer);
    if (page?.window === window) {
      page = null;
      idle.cancel();
    }
    settleReady(null);
    listener.lost();
    if (!window.isDestroyed()) {
      window.destroy();
    }
  };

  const send: SendRequest = (request) => {
    if (closed) {
      return false;
    }
    idle.schedule();
    contents.send(CAPTCHA_CHANNELS.request, request);
    return true;
  };

  const onMessage = (message: PageMessage) => {
    idle.schedule();
    switch (message.type) {
      case 'ready':
        clearTimeout(readyTimer);
        settleReady(send);
        return;
      // The page's failure is sticky until a reload, so the window goes and the next request makes a new one
      case 'unavailable':
        close('error', `page reported ${message.code}`);
        return;
      case 'resolve':
      case 'reject':
        listener.answer(message);
    }
  };

  for (const [channel, schema] of Object.entries(PAGE_MESSAGES)) {
    contents.ipc.on(channel, (event, ...args: unknown[]) => {
      if (!isFromCaptchaPage(event, contents, url.origin)) {
        console.warn(`[Turnstile] Ignored ${channel} from outside the captcha page`);
        return;
      }
      const message = schema.safeParse(args);
      if (message.success) {
        onMessage(message.data);
      } else {
        console.warn(`[Turnstile] Ignored a malformed ${channel}`);
      }
    });
  }

  lockDown(window, url.origin);
  // The landing answers a foreign User-Agent with 404 and a missing site key with 503, and neither fails the load
  contents.on('did-navigate', (_event, _url, status) => {
    if (status !== 200) {
      close('error', `HTTP ${status}`);
    }
  });
  contents.on('did-fail-load', (_event, code, description, _url, isMainFrame) => {
    if (isMainFrame) {
      close('warn', `load failed: ${code} ${description}`);
    }
  });
  contents.on('render-process-gone', (_event, details) => {
    close('warn', `renderer ${details.reason}`);
  });
  window.on('closed', () => close('log', 'closed'));
  // did-fail-load reports a failed load with its code
  window.loadURL(url.href).catch(() => undefined);

  return { window, ready, close };
}

// Made on the first request and reused until it fails, idles or the app leaves
export function openCaptchaPage(
  url: URL,
  listener: CaptchaPageListener
): Promise<SendRequest | null> {
  if (quitting) {
    return Promise.resolve(null);
  }
  page ??= createPage(url, listener);
  idle.schedule();
  return page.ready;
}

// A hidden window left alive keeps window-all-closed from quitting on Windows and Linux
export function destroyCaptchaWindow(): void {
  page?.close('log', 'destroyed');
}

// A window made after before-quit would outlive the quit
export function stopCaptchaWindow(): void {
  quitting = true;
  destroyCaptchaWindow();
}
