import { test, expect, type Page } from '@playwright/test';
import { launchApp, waitForAppReady, type AppInstance } from '../helpers/launch';

let instance: AppInstance;
let page: Page;

test.beforeAll(async () => {
  instance = await launchApp();
  page = instance.page;
  await waitForAppReady(page);
});

test.afterAll(async () => {
  await instance?.close();
});

test('app window is visible with correct minimum size', async () => {
  const size = await page.evaluate(() => ({
    width: window.outerWidth,
    height: window.outerHeight,
  }));

  // Windows CI may have DPI scaling (125-150%) which reduces CSS pixel values
  const minWidth = process.platform === 'win32' ? 900 : 1200;
  const minHeight = process.platform === 'win32' ? 500 : 700;
  expect(size.width).toBeGreaterThanOrEqual(minWidth);
  expect(size.height).toBeGreaterThanOrEqual(minHeight);
});

test('main UI is visible after sync', async () => {
  await expect(page.getByPlaceholder('Пошук гри...')).toBeVisible();
});

test('title bar displays version', async () => {
  const versionText = await page.locator('.drag-region').textContent();
  expect(versionText).toMatch(/v\d+\.\d+\.\d+/);
});

test('game list has items from Supabase', async () => {
  const gameItems = page.locator('[data-nav-group="game-list"]');
  const count = await gameItems.count();
  expect(count).toBeGreaterThan(0);
});
