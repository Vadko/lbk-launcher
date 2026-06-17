import { expect, type Page, test } from '@playwright/test';
import { type AppInstance, launchApp, waitForAppReady } from '../helpers/launch';

let instance: AppInstance;
let page: Page;

test.beforeAll(async () => {
  instance = await launchApp();
  page = instance.page;
  await waitForAppReady(page);

  // Navigate to the news page — NewsFeedSection lives on /news, not on home.
  await page.getByTitle('Відкрити новини').click();
  await page.getByRole('heading', { name: 'Новини' }).waitFor({ state: 'visible' });
});

test.afterAll(async () => {
  await instance?.close();
});

const newsSection = () =>
  page.locator('section').filter({ has: page.getByRole('heading', { name: 'Новини' }) });

const tab = (label: string) => page.getByRole('button', { name: label, exact: true });

test('news section renders heading and three filter tabs', async () => {
  await expect(page.getByRole('heading', { name: 'Новини' })).toBeVisible();
  await expect(tab('Ігри по знижці')).toBeVisible();
  await expect(tab('Ігри за 80')).toBeVisible();
  await expect(tab('Новини')).toBeVisible();
});

test('default active tab is "Ігри по знижці"', async () => {
  const cls = await tab('Ігри по знижці').getAttribute('class');
  expect(cls).toContain('from-color-accent');
});

test('clicking another tab switches the active state', async () => {
  const games80 = tab('Ігри за 80');
  await games80.click();

  await expect.poll(async () => games80.getAttribute('class')).toContain('from-color-accent');
  const salesCls = await tab('Ігри по знижці').getAttribute('class');
  expect(salesCls).not.toContain('from-color-accent');
});

test('switched tab shows posts or empty state after loading', async () => {
  await tab('Ігри по знижці').click();

  const articles = newsSection().locator('article');
  const empty = newsSection().getByText('Новин не знайдено');

  await expect
    .poll(
      async () => {
        const articleCount = await articles.count();
        const isEmpty = await empty.isVisible().catch(() => false);
        return articleCount > 0 || isEmpty;
      },
      { timeout: 10_000 }
    )
    .toBe(true);
});
