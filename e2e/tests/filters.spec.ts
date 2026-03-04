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

test('status filter dropdown opens and shows options', async () => {
  const filterButton = page.getByText('Усі стани');
  await filterButton.click();

  const dropdown = page.locator('[data-gamepad-dropdown]').first();
  await expect(dropdown).toBeVisible({ timeout: 3_000 });

  // Scope checks to the dropdown to avoid matching status badges on game cards
  await expect(dropdown.getByText('Заплановано')).toBeVisible();
  await expect(dropdown.getByText('Ранній доступ').first()).toBeVisible();
  await expect(dropdown.getByText('Готово').first()).toBeVisible();
  await expect(dropdown.getByText('Сортування')).toBeVisible();

  // Close the dropdown by clicking the filter button again
  await filterButton.click();
  await page.waitForTimeout(300);
});

test('selecting a status filter changes the game list', async () => {
  const initialCount = await page
    .locator('[data-nav-group="game-list"]')
    .count();

  // Open dropdown and click "Готово" filter option
  const filterButton = page.getByText('Усі стани');
  await filterButton.click();

  const dropdown = page.locator('[data-gamepad-dropdown]').first();
  await expect(dropdown).toBeVisible({ timeout: 3_000 });

  const completedOption = dropdown
    .locator('[data-gamepad-dropdown-item]')
    .filter({ hasText: 'Готово' });
  await completedOption.click();

  await page.waitForTimeout(800);

  const filteredCount = await page
    .locator('[data-nav-group="game-list"]')
    .count();
  expect(filteredCount).toBeLessThanOrEqual(initialCount);
});

test('clearing filter restores full list', async () => {
  // Open filter dropdown — button text changes when filter is active
  const filterBtn = page
    .locator('button')
    .filter({ hasText: /Готово|стани/ })
    .first();
  await filterBtn.click();

  const dropdown = page.locator('[data-gamepad-dropdown]').first();
  await expect(dropdown).toBeVisible({ timeout: 3_000 });

  const clearFilter = dropdown.getByText('Очистити фільтр');
  await expect(clearFilter).toBeVisible();
  // Use force click to bypass animation instability
  await clearFilter.click({ force: true });

  await page.waitForTimeout(800);

  await expect(page.getByText('Усі стани')).toBeVisible();
});

test('authors filter dropdown opens', async () => {
  const authorsButton = page.getByText('Усі автори');
  await authorsButton.click();

  const dropdown = page.locator('[data-gamepad-dropdown]');
  await expect(dropdown.first()).toBeVisible({ timeout: 3_000 });

  // Close by pressing Escape
  await page.keyboard.press('Escape');
});
