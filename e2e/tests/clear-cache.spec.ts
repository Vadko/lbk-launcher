import { test, expect, type Page } from '@playwright/test';
import { chromium } from 'playwright-core';
import {
  launchApp,
  waitForAppReady,
  killProcessOnPort,
  type AppInstance,
} from '../helpers/launch';

const CDP_PORT = 19222;

/**
 * Wait for a NEW app instance on CDP (detected by changed WebSocket URL).
 * This avoids the race condition where the restarted app binds to the port
 * before we can detect the old one went down.
 */
async function waitForAppRestart(
  oldWsUrl: string,
  timeout: number
): Promise<void> {
  const start = Date.now();
  let seenDown = false;

  while (Date.now() - start < timeout) {
    try {
      const response = await fetch(
        `http://127.0.0.1:${CDP_PORT}/json/version`
      );
      if (response.ok) {
        const data = (await response.json()) as {
          webSocketDebuggerUrl?: string;
        };
        const newWsUrl = data.webSocketDebuggerUrl || '';

        if (newWsUrl && newWsUrl !== oldWsUrl) {
          // New app instance is up with a different WebSocket URL
          console.log('[clear-cache] Detected restarted app (new WS URL)');
          return;
        }

        if (seenDown) {
          // Port came back but same URL? Unlikely, but treat as restart
          console.log('[clear-cache] Port came back after being down');
          return;
        }
      }
    } catch {
      // Connection refused — app is down, mark it
      seenDown = true;
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error(`App did not restart after ${timeout}ms`);
}

/**
 * Connect to an already-running app via CDP and return a Page.
 */
async function connectToApp() {
  const browser = await chromium.connectOverCDP(
    `http://127.0.0.1:${CDP_PORT}`
  );
  const context = browser.contexts()[0];

  let page: Page;
  const deadline = Date.now() + 30_000;
  while (context.pages().length === 0 && Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 200));
  }
  page =
    context.pages().length > 0
      ? context.pages()[0]
      : await context.waitForEvent('page', { timeout: 10_000 });

  return { browser, page };
}

let instance: AppInstance;
let page: Page;

test.beforeAll(async () => {
  instance = await launchApp();
  page = instance.page;
  await waitForAppReady(page);
});

test.afterAll(async () => {
  // First disconnect Playwright from the browser
  try {
    await instance?.close();
  } catch {
    /* already closed */
  }

  // Kill only the LISTENING process on the CDP port, not client connections.
  // Using lsof without -sTCP:LISTEN would also find our own Playwright worker
  // (which has a client TCP connection to that port) and SIGKILL us.
  try {
    const { execSync } = await import('child_process');
    if (process.platform === 'win32') {
      killProcessOnPort(CDP_PORT);
    } else {
      const output = execSync(`lsof -ti tcp:${CDP_PORT} -sTCP:LISTEN`, {
        encoding: 'utf-8',
      });
      const pids = output.trim().split('\n').filter(Boolean);
      for (const pid of pids) {
        try {
          execSync(`kill -9 ${pid}`, { stdio: 'ignore' });
          console.log(`[clear-cache] Killed listening process ${pid} on port ${CDP_PORT}`);
        } catch {
          /* already dead */
        }
      }
    }
  } catch {
    /* no process found — fine */
  }
});

test('clear cache restarts the app and loads games', async () => {
  // 1. Verify games are loaded before reset
  const gamesBefore = page.locator('[data-nav-group="game-list"]');
  const countBefore = await gamesBefore.count();
  expect(countBefore).toBeGreaterThan(0);

  // 2. Get current WebSocket URL to detect restart
  const versionRes = await fetch(
    `http://127.0.0.1:${CDP_PORT}/json/version`
  );
  const versionData = (await versionRes.json()) as {
    webSocketDebuggerUrl?: string;
  };
  const oldWsUrl = versionData.webSocketDebuggerUrl || '';

  // 3. Open settings
  const settingsButton = page.locator('button[title="Налаштування"]');
  await settingsButton.click();
  const modal = page.locator('div[role="dialog"]');
  await expect(modal).toBeVisible({ timeout: 5_000 });

  // 4. Click "Очистити кеш" to open confirmation dialog
  const clearCacheButton = modal.getByText('Очистити кеш');
  await expect(clearCacheButton).toBeVisible();
  await clearCacheButton.click();

  // 5. Confirm in the confirmation modal — use noWaitAfter since the app will exit
  const confirmModal = page.locator('div[role="dialog"]').last();
  const confirmButton = confirmModal.getByText('Очистити');
  await expect(confirmButton).toBeVisible({ timeout: 5_000 });
  await confirmButton.click({ noWaitAfter: true });

  // 7. Disconnect Playwright (app is shutting down)
  try {
    await instance.browser.close();
  } catch {
    /* already closing */
  }

  // 8. Wait for the app to restart (detect by changed WebSocket URL)
  await waitForAppRestart(oldWsUrl, 60_000);

  // 9. Give the restarted app a moment to fully initialize its CDP server
  await new Promise((r) => setTimeout(r, 3_000));

  // 10. Connect to the restarted app
  const restarted = await connectToApp();
  const newPage = restarted.page;

  // Update instance for cleanup
  instance = {
    browser: restarted.browser,
    context: restarted.browser.contexts()[0],
    page: newPage,
    close: async () => {
      try {
        await restarted.browser.close();
      } catch {
        /* already closed */
      }
    },
  };
  page = newPage;

  // 11. Wait for the app to finish syncing
  await waitForAppReady(newPage);

  // 12. Verify games are loaded after restart (re-synced from Supabase)
  const gamesAfter = newPage.locator('[data-nav-group="game-list"]');
  const countAfter = await gamesAfter.count();
  expect(countAfter).toBeGreaterThan(0);
});
