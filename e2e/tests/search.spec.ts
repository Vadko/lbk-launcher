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

test('search bar accepts input', async () => {
  const searchBar = page.getByPlaceholder('Пошук гри...');
  await searchBar.click();
  await searchBar.fill('Witcher');

  await expect(searchBar).toHaveValue('Witcher');
});

test('search filters the game list', async () => {
  const searchBar = page.getByPlaceholder('Пошук гри...');
  const gameItems = page.locator('[data-nav-group="game-list"]');

  // Clear and get total count
  await searchBar.fill('');
  // Wait for debounce (300ms) + render
  await page.waitForTimeout(800);
  const allGamesCount = await gameItems.count();
  expect(allGamesCount).toBeGreaterThan(0);

  // Search for a nonexistent game — use a truly impossible string
  await searchBar.fill('xq9z8w7v6u5t4');
  await page.waitForTimeout(800);

  // Either 0 results or "Ігор не знайдено" message appears
  const noResultsMessage = page.getByText('Ігор не знайдено');
  const noResults = await gameItems.count();
  const hasNoResultsMessage = await noResultsMessage.isVisible().catch(() => false);
  expect(noResults === 0 || hasNoResultsMessage).toBe(true);

  // Clear search — all games return
  await searchBar.fill('');
  await page.waitForTimeout(800);
  const restoredCount = await gameItems.count();
  expect(restoredCount).toBe(allGamesCount);
});
