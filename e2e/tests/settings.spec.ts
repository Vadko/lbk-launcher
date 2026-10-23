import { test, expect, type Page } from '@playwright/test';
import { launchApp, waitForAppReady, type AppInstance } from '../helpers/launch';
import { t } from '../../src/shared/i18n/i18n';

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

  const settingsButton = page.locator(`button[title="${t('sidebarNav.settings')}"]`);
  await settingsButton.click();
  await expect(modal).toBeVisible({ timeout: 5_000 });
}

test('settings modal opens from gear icon', async () => {
  await openSettings();
  await expect(page.locator('#modal-title')).toHaveText(t('settings.title'));
});

test('settings modal contains expected toggles', async () => {
  await openSettings();
  const modal = page.locator('div[role="dialog"]');

  // Use getByRole('heading') to avoid matching description text
  await expect(modal.getByRole('heading', { name: t('settings.performance.title') })).toBeVisible();
  await expect(
    modal.getByRole('heading', { name: t('settings.backup.title') }),
  ).toBeVisible();
  await expect(
    modal.getByRole('heading', { name: t('settings.aiTranslations.title') }),
  ).toBeVisible();
  await expect(
    modal.getByRole('heading', { name: t('settings.recommendations.title') }),
  ).toBeVisible();
  await expect(
    modal.getByRole('heading', { name: t('settings.notificationSounds.title') }),
  ).toBeVisible();
});

test('settings modal contains action buttons', async () => {
  await openSettings();
  const modal = page.locator('div[role="dialog"]');

  await expect(modal.getByText(t('settings.clearCache.title'))).toBeVisible();
  await expect(modal.getByText(t('settings.clearAll.title'))).toBeVisible();
});
