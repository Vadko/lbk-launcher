import { F } from '@mobily/ts-belt';
import { app, BrowserWindow } from 'electron';
import { z } from 'zod';
import { errorMessage } from '../../shared/errors';
import type { TurnstileAction } from '../../shared/game-reviews-api-types';
import { reportCaptchaFault } from './report-captcha-fault';
import { captchaSession } from './session';

const IDLE_MS = 3 * 60_000;

// The page is remote, so its answer is checked
const PageAnswer = z.union([
  z.object({ token: z.string().min(1) }),
  z.object({ error: z.string() }),
]);

export type CaptchaAnswer = z.infer<typeof PageAnswer>;

type CloseLog = 'log' | 'warn' | 'error';

interface CaptchaPage {
  solve: (action: TurnstileAction, cData: string) => Promise<CaptchaAnswer | null>;
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

function createPage(url: URL): CaptchaPage {
  const window = newWindow();
  const contents = window.webContents;
  let closed = false;
  const loaded = Promise.withResolvers<boolean>();
  // A solve still running when the window goes would otherwise never settle
  const gone = Promise.withResolvers<null>();

  const close = (log: CloseLog, reason: string) => {
    if (closed) {
      return;
    }
    closed = true;
    // An error is a landing fault that stops every public write
    if (log === 'error') {
      reportCaptchaFault(`window closed: ${reason}`);
    } else {
      console[log](`[Turnstile] Captcha window closed: ${reason}`);
    }
    page = null;
    idle.cancel();
    loaded.resolve(false);
    gone.resolve(null);
    if (!window.isDestroyed()) {
      window.destroy();
    }
  };

  // window.lbkCaptcha.solve is the landing page's whole contract (lbk-landing src/lib/captcha/page-script.ts)
  const run = async (action: TurnstileAction, cData: string) => {
    try {
      const answer = PageAnswer.safeParse(
        await contents.executeJavaScript(
          `window.lbkCaptcha.solve(${JSON.stringify(action)}, ${JSON.stringify(cData)})`
        )
      );
      if (answer.success) {
        return answer.data;
      }
      close('error', 'malformed answer');
    } catch (error) {
      close('error', `solve threw: ${errorMessage(error)}`);
    }
    return null;
  };

  const solve = async (action: TurnstileAction, cData: string) => {
    if (!(await loaded.promise)) {
      return null;
    }
    const answer = await Promise.race([run(action, cData), gone.promise]);
    if (answer === null) {
      return null;
    }
    idle.schedule();
    // The page's failure is sticky until a reload, so the window goes and the next solve makes a new one
    if ('error' in answer && answer.error === 'script_error') {
      close('error', 'page reported script_error');
      return null;
    }
    return answer;
  };

  lockDown(window, url.origin);
  // The landing answers a foreign User-Agent with 404 and a missing site key with 503, and neither fails the load
  contents.on('did-navigate', (_event, _url, status) => {
    if (status !== 200) {
      close('error', `HTTP ${status}`);
    }
  });
  contents.on('did-finish-load', () => loaded.resolve(true));
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

  return { solve, close };
}

// The page is made on the first solve and reused until it fails, idles or the app leaves; null when it is gone
export function solveCaptcha(
  url: URL,
  action: TurnstileAction,
  cData: string
): Promise<CaptchaAnswer | null> {
  if (quitting) {
    return Promise.resolve(null);
  }
  page ??= createPage(url);
  idle.schedule();
  return page.solve(action, cData);
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
