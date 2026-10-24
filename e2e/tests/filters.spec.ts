import { test, expect, type Page } from '@playwright/test';
import { launchApp, waitForAppReady, type AppInstance } from '../helpers/launch';
import { t } from '../../src/shared/i18n/i18n';

let instance: AppInstance;
let page: Page;
let initialCount = 0;

test.beforeAll(async () => {
  instance = await launchApp();
  page = instance.page;
  await waitForAppReady(page);
});

test.afterAll(async () => {
  await instance?.close();
});

test('filters modal opens and shows status options', async () => {
  await page.getByText(t('filterBar.filters')).click();

  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible({ timeout: 3_000 });
  await expect(dialog.getByText(t('catalogFilters.title'))).toBeVisible();

  await expect(dialog.getByText(t('filterOptions.status.planned'))).toBeVisible();
  await expect(dialog.getByText(t('filterOptions.status.in-progress')).first()).toBeVisible();
  await expect(dialog.getByText(t('filterOptions.status.completed')).first()).toBeVisible();
  await expect(dialog.getByText(t('filterOptions.status.tech-improvement'))).toBeVisible();

  // Close via Escape — the filters button opens but does not toggle the modal
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
});

test('selecting a status filter changes the game list', async () => {
  initialCount = await page.locator('[data-nav-group="game-list"]').count();

  await page.getByText(t('filterBar.filters')).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible({ timeout: 3_000 });

  const completedPill = dialog
    .locator('[data-gamepad-modal-item]')
    .filter({ hasText: t('filterOptions.status.completed') });
  await completedPill.click();

  await dialog.getByText(t('catalogFilters.apply')).click();
  await expect(dialog).toBeHidden();

  await page.waitForTimeout(800);

  const filteredCount = await page.locator('[data-nav-group="game-list"]').count();
  expect(filteredCount).toBeLessThanOrEqual(initialCount);
});

test('clearing all filters restores full list', async () => {
  const clearAllButton = page.getByTitle(t('filterBar.clearAll'));
  await expect(clearAllButton).toBeVisible();
  await clearAllButton.click();

  await page.waitForTimeout(800);

  await expect(page.getByTitle(t('filterBar.clearAll'))).toBeHidden();

  const restoredCount = await page.locator('[data-nav-group="game-list"]').count();
  expect(restoredCount).toBe(initialCount);
});

test('authors filter list is searchable', async () => {
  await page.getByText(t('filterBar.filters')).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible({ timeout: 3_000 });

  await expect(dialog.getByText(t('catalogFilters.authorsSection'))).toBeVisible();
  const searchInput = dialog.getByPlaceholder(t('catalogFilters.searchAuthor'));
  await expect(searchInput).toBeVisible();

  // Close by pressing Escape
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
});

test('selecting a tag filter changes the game list', async () => {
  const initialCount = await page.locator('[data-nav-group="game-list"]').count();

  await page.getByText(t('filterBar.filters')).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible({ timeout: 3_000 });

  // Tags is the second SearchableFilterList in the modal (authors, then tags)
  const tagsSection = dialog.locator('.searchable-filter-list').last();
  const tagRows = tagsSection.locator('button[data-gamepad-modal-item]');
  await expect(tagRows.first()).toBeVisible({ timeout: 5_000 });
  await tagRows.first().click();

  await dialog.getByText(t('catalogFilters.apply')).click();
  await expect(dialog).toBeHidden();

  await page.waitForTimeout(800);

  const filteredCount = await page.locator('[data-nav-group="game-list"]').count();
  expect(filteredCount).toBeLessThanOrEqual(initialCount);

  // Restore state for subsequent tests
  await page.getByTitle(t('filterBar.clearAll')).click();
  await page.waitForTimeout(800);
  expect(await page.locator('[data-nav-group="game-list"]').count()).toBe(initialCount);
});

test('quick filters toggle installed translations and favorites', async () => {
  const initialCount = await page.locator('[data-nav-group="game-list"]').count();

  const installedToggle = page
    .getByTitle(t('filterBar.showInstalled'), { exact: true })
    .or(page.getByTitle(t('filterBar.hideInstalled'), { exact: true }));
  await installedToggle.click();
  await page.waitForTimeout(500);
  expect(
    await page.locator('[data-nav-group="game-list"]').count()
  ).toBeLessThanOrEqual(initialCount);

  await installedToggle.click();
  await page.waitForTimeout(500);
  expect(await page.locator('[data-nav-group="game-list"]').count()).toBe(initialCount);

  const favoriteToggle = page
    .getByTitle(t('filterBar.showFavorites'), { exact: true })
    .or(page.getByTitle(t('filterBar.hideFavorites'), { exact: true }));
  await favoriteToggle.click();
  await page.waitForTimeout(500);
  expect(
    await page.locator('[data-nav-group="game-list"]').count()
  ).toBeLessThanOrEqual(initialCount);

  await favoriteToggle.click();
  await page.waitForTimeout(500);
  expect(await page.locator('[data-nav-group="game-list"]').count()).toBe(initialCount);
});

test('sort dropdown opens, lists options, and reorders the game list', async () => {
  const sortButton = page.getByTitle(t('filterBar.sort'));
  await sortButton.click();

  const dropdown = page.locator('[data-gamepad-dropdown]').first();
  await expect(dropdown).toBeVisible({ timeout: 3_000 });

  await expect(dropdown.getByText(t('filterOptions.sort.name'))).toBeVisible();
  await expect(dropdown.getByText(t('filterOptions.sort.downloads'))).toBeVisible();
  await expect(dropdown.getByText(t('filterOptions.sort.subscribers'))).toBeVisible();
  await expect(dropdown.getByText(t('filterOptions.sort.newest'))).toBeVisible();

  await dropdown
    .locator('[data-gamepad-dropdown-item]')
    .filter({ hasText: t('filterOptions.sort.name') })
    .click();
  await expect(dropdown).toBeHidden();
  await page.waitForTimeout(500);

  const firstGameByName = await page
    .locator('[data-nav-group="game-list"]')
    .first()
    .textContent();

  await sortButton.click();
  await expect(dropdown).toBeVisible({ timeout: 3_000 });
  await dropdown
    .locator('[data-gamepad-dropdown-item]')
    .filter({ hasText: t('filterOptions.sort.downloads') })
    .click();
  await expect(dropdown).toBeHidden();
  await page.waitForTimeout(500);

  const firstGameByPopularity = await page
    .locator('[data-nav-group="game-list"]')
    .first()
    .textContent();

  expect(firstGameByPopularity).not.toBe(firstGameByName);
});
