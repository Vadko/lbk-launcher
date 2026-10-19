import { F } from '@mobily/ts-belt';
import { execFile, spawn } from 'child_process';
import { shell } from 'electron';
import { promisify } from 'util';
import { isLinux } from './platform';

const execFileAsync = promisify(execFile);
const PROBE_TIMEOUT_MS = 2000;

interface BrowserCommand {
  command: string;
  args: string[];
}

const FLATPAK_BROWSERS = [
  'org.mozilla.firefox',
  'com.google.Chrome',
  'org.chromium.Chromium',
  'com.brave.Browser',
];
const NATIVE_BROWSERS = [
  'firefox',
  'chromium',
  'chromium-browser',
  'google-chrome',
  'brave-browser',
];

const flatpakBrowser = (appId: string) => ({ command: 'flatpak', args: ['run', appId] });
const nativeBrowser = (binary: string) => ({ command: binary, args: [] });

async function succeeds(command: string, args: string[]): Promise<boolean> {
  try {
    await execFileAsync(command, args, { timeout: PROBE_TIMEOUT_MS });
    return true;
  } catch {
    return false;
  }
}

const isFlatpakApp = (appId: string) => succeeds('flatpak', ['info', appId]);
const isOnPath = (binary: string) => succeeds('which', [binary]);

async function firstFound(
  candidates: string[],
  isInstalled: (candidate: string) => Promise<boolean>,
  toCommand: (candidate: string) => BrowserCommand
): Promise<BrowserCommand | null> {
  for (const candidate of candidates) {
    if (await isInstalled(candidate)) {
      return toCommand(candidate);
    }
  }
  return null;
}

async function xdgDefaultBrowser(): Promise<BrowserCommand | null> {
  try {
    const { stdout } = await execFileAsync(
      'xdg-settings',
      ['get', 'default-web-browser'],
      { timeout: PROBE_TIMEOUT_MS }
    );
    const appId = stdout.trim().replace(/\.desktop$/, '');
    if (!appId) {
      return null;
    }
    if (await isFlatpakApp(appId)) {
      return flatpakBrowser(appId);
    }
    const binary = appId.split('.').pop() ?? appId;
    return (await isOnPath(binary)) ? nativeBrowser(binary) : null;
  } catch {
    return null;
  }
}

// SteamOS's xdg-open goes through kde-open5, which often misses Flatpak browsers and opens Discover instead
const detectLinuxBrowser = F.once(async (): Promise<BrowserCommand | null> => {
  const browser =
    (await xdgDefaultBrowser()) ??
    (await firstFound(FLATPAK_BROWSERS, isFlatpakApp, flatpakBrowser)) ??
    (await firstFound(NATIVE_BROWSERS, isOnPath, nativeBrowser));
  console.log(
    browser
      ? `[OpenExternal] Detected browser: ${browser.command} ${browser.args.join(' ')}`
      : '[OpenExternal] No browser detected, falling back to shell.openExternal'
  );
  return browser;
});

export async function openExternalUrl(
  url: string
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!url) {
      throw new Error(`[OpenExternal] Invalid URL: ${JSON.stringify(url)}`);
    }

    const trimmed = url.trim();
    if (!trimmed) {
      throw new Error('[OpenExternal] Empty URL');
    }

    if (/^(file|javascript|data|vbscript):/i.test(trimmed)) {
      throw new Error(
        `[OpenExternal] Refusing to open URL with unsafe protocol: ${trimmed}`
      );
    }

    if (!isLinux()) {
      await shell.openExternal(trimmed);
      return { success: true };
    }

    const browser = await detectLinuxBrowser();
    if (browser) {
      const child = spawn(browser.command, [...browser.args, url], {
        detached: true,
        stdio: 'ignore',
      });
      child.unref();
      return { success: true };
    }

    // Fallback to Electron's default (xdg-open)
    await shell.openExternal(url);
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error',
    };
  }
}
