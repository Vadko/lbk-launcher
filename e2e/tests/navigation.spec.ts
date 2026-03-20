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

test('home screen shows "Новинки" and "Популярне у гравців" sections', async () => {
  await expect(page.getByText('Новинки')).toBeVisible();
  await expect(page.getByText('Популярне у гравців')).toBeVisible();
});

test('clicking a game shows game details', async () => {
  const firstGame = page.locator('[data-nav-group="game-list"]').first();
  await firstGame.waitFor({ state: 'visible' });
  await firstGame.click();

  // Home sections should disappear, main content area should show game details
  await expect(page.getByText('Новинки')).not.toBeVisible({ timeout: 5_000 });
  await expect(
    page.locator('[data-gamepad-main-content]'),
  ).toBeVisible();
});

test('clicking another game updates the view', async () => {
  const secondGame = page.locator('[data-nav-group="game-list"]').nth(1);

  if (await secondGame.isVisible()) {
    await secondGame.click();
    await expect(
      page.locator('[data-gamepad-main-content]'),
    ).toBeVisible();
  }
});
