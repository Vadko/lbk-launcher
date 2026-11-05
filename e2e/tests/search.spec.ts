import { test, expect, type Page } from '@playwright/test';
import { gameListSize } from '../helpers/gameList';
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

test('search bar accepts input', async () => {
  const searchBar = page.getByPlaceholder(t('gameSearch.placeholder'));
  await searchBar.click();
  await searchBar.fill('Witcher');

  await expect(searchBar).toHaveValue('Witcher');
});

test('search filters the game list', async () => {
  const searchBar = page.getByPlaceholder(t('gameSearch.placeholder'));

  await searchBar.fill('');
  await expect.poll(() => gameListSize(page)).toBeGreaterThan(0);
  const allGamesCount = await gameListSize(page);

  await searchBar.fill('xq9z8w7v6u5t4');
  await expect.poll(() => gameListSize(page)).toBe(0);

  await searchBar.fill('');
  await expect.poll(() => gameListSize(page)).toBe(allGamesCount);
});
