import { execSync, spawn } from 'child_process';
import { shell } from 'electron';
import { isLinux } from './platform';

interface BrowserCommand {
  command: string;
  args: string[];
}

let cachedBrowser: BrowserCommand | null | undefined;

/**
 * Detect an available browser on Linux by directly checking installed apps.
 * On SteamOS, xdg-open delegates to kde-open5, which often fails to find the
 * Flatpak-installed browser and redirects to the Discover app store instead.
 */
function detectLinuxBrowser(): BrowserCommand | null {
  const execOpts = { stdio: 'ignore' as const, timeout: 2000 };

  // 1. Try to resolve the xdg default browser directly
  try {
    const desktopFile = execSync('xdg-settings get default-web-browser', {
      encoding: 'utf-8',
      timeout: 2000,
    }).trim();

    if (desktopFile) {
      const appId = desktopFile.replace(/\.desktop$/, '');

      // Check if it's a Flatpak app
      try {
        execSync(`flatpak info ${appId}`, execOpts);
        return { command: 'flatpak', args: ['run', appId] };
      } catch {
        // Not a Flatpak — try as native binary
        const binaryName = appId.includes('.') ? appId.split('.').pop()! : appId;
        try {
          execSync(`which ${binaryName}`, execOpts);
          return { command: binaryName, args: [] };
        } catch {
          // Binary not found by simple name
        }
      }
    }
  } catch {
    // xdg-settings not available or failed
  }

  // 2. Scan for known Flatpak browsers (common on SteamOS)
  const flatpakBrowsers = [
    'org.mozilla.firefox',
    'com.google.Chrome',
    'org.chromium.Chromium',
    'com.brave.Browser',
  ];

  for (const appId of flatpakBrowsers) {
    try {
      execSync(`flatpak info ${appId}`, execOpts);
      return { command: 'flatpak', args: ['run', appId] };
    } catch {
      // Not installed
    }
  }

  // 3. Scan for known native browsers
  const nativeBrowsers = [
    'firefox',
    'chromium',
    'chromium-browser',
    'google-chrome',
    'brave-browser',
  ];

  for (const browser of nativeBrowsers) {
    try {
      execSync(`which ${browser}`, execOpts);
      return { command: browser, args: [] };
    } catch {
      // Not found
    }
  }

  return null;
}

/**
 * Open a URL in the system browser.
 * On Linux (especially SteamOS), bypasses xdg-open to avoid the Discover store redirect
 * by detecting and launching the browser directly.
 */
export async function openExternalUrl(url: string): Promise<void> {
  if (!isLinux()) {
    await shell.openExternal(url);
    return;
  }

  // Lazily detect and cache the browser
  if (cachedBrowser === undefined) {
    cachedBrowser = detectLinuxBrowser();
    console.log(
      cachedBrowser
        ? `[OpenExternal] Detected browser: ${cachedBrowser.command} ${cachedBrowser.args.join(' ')}`
        : '[OpenExternal] No browser detected, falling back to shell.openExternal'
    );
  }

  if (cachedBrowser) {
    const child = spawn(cachedBrowser.command, [...cachedBrowser.args, url], {
      detached: true,
      stdio: 'ignore',
    });
    child.unref();
    return;
  }

  // Fallback to Electron's default (xdg-open)
  await shell.openExternal(url);
}
