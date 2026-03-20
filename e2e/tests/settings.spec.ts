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

async function openSettings() {
  const modal = page.locator('div[role="dialog"]');
  if (await modal.isVisible().catch(() => false)) return;

  const settingsButton = page.locator('button[title="Налаштування"]');
  await settingsButton.click();
  await expect(modal).toBeVisible({ timeout: 5_000 });
}

test('settings modal opens from gear icon', async () => {
  await openSettings();
  await expect(page.locator('#modal-title')).toHaveText('Налаштування');
});

test('settings modal contains expected toggles', async () => {
  await openSettings();
  const modal = page.locator('div[role="dialog"]');

  // Use getByRole('heading') to avoid matching description text
  await expect(modal.getByRole('heading', { name: 'Анімації' })).toBeVisible();
  await expect(
    modal.getByRole('heading', { name: 'Створювати резервну копію' }),
  ).toBeVisible();
  await expect(
    modal.getByRole('heading', { name: 'Приховати ШІ-переклади' }),
  ).toBeVisible();
  await expect(
    modal.getByRole('heading', { name: 'Звуки сповіщень' }),
  ).toBeVisible();
});

test('settings modal contains action buttons', async () => {
  await openSettings();
  const modal = page.locator('div[role="dialog"]');

  await expect(modal.getByText('Очистити кеш')).toBeVisible();
  await expect(modal.getByText('Очистити всі дані')).toBeVisible();
});

test('settings modal closes with close button', async () => {
  await openSettings();

  // Close via the close button in the modal footer
  const modal = page.locator('div[role="dialog"]');
  const closeButton = modal.getByRole('button', { name: 'Закрити' });
  await closeButton.click();

  await expect(modal).not.toBeVisible({ timeout: 3_000 });
});
