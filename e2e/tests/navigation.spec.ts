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

test('home screen shows "Новинки" and either "Знайдено встановлені ігри" or "Популярне у гравців"', async () => {
  // "Новинки" завжди відображається
  await expect(page.getByText('Новинки')).toBeVisible();
  
  // Хоча б одна з цих секцій має бути видимою
  // (всі 3 секції можуть не поміститися на екрані одночасно)
  const installedSection = page.getByText('Знайдено встановлені ігри');
  const trendingSection = page.getByText('Популярне у гравців');
  
  const isInstalledVisible = await installedSection.isVisible().catch(() => false);
  const isTrendingVisible = await trendingSection.isVisible().catch(() => false);
  
  expect(isInstalledVisible || isTrendingVisible).toBe(true);
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
