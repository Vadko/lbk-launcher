import { expect, type Page, test } from '@playwright/test';
import { type AppInstance, launchApp, waitForAppReady } from '../helpers/launch';
import { t } from '../../src/shared/i18n/i18n';

let instance: AppInstance;
let page: Page;

test.beforeAll(async () => {
  instance = await launchApp();
  page = instance.page;
  await waitForAppReady(page);

  // Navigate to the news page — NewsFeedSection lives on /news, not on home.
  await page.getByTitle(t('sidebarNav.news')).click();
  await page.getByRole('heading', { name: t('newsFeed.title') }).waitFor({ state: 'visible' });
});

test.afterAll(async () => {
  await instance?.close();
});

const newsSection = () =>
  page.locator('section').filter({ has: page.getByRole('heading', { name: t('newsFeed.title') }) });

const tab = (label: string) => page.getByRole('button', { name: label, exact: true });

test('news section renders heading and three filter tabs', async () => {
  await expect(page.getByRole('heading', { name: t('newsFeed.title') })).toBeVisible();
  await expect(tab(t('newsFeed.tab.sales'))).toBeVisible();
  await expect(tab(t('newsFeed.tab.games-80'))).toBeVisible();
  await expect(tab(t('newsFeed.tab.news'))).toBeVisible();
});

test(`default active tab is "${t('newsFeed.tab.sales')}"`, async () => {
  const cls = await tab(t('newsFeed.tab.sales')).getAttribute('class');
  expect(cls).toContain('from-color-accent');
});

test('clicking another tab switches the active state', async () => {
  const games80 = tab(t('newsFeed.tab.games-80'));
  await games80.click();

  await expect.poll(async () => games80.getAttribute('class')).toContain('from-color-accent');
  const salesCls = await tab(t('newsFeed.tab.sales')).getAttribute('class');
  expect(salesCls).not.toContain('from-color-accent');
});

test('switched tab shows posts or empty state after loading', async () => {
  await tab(t('newsFeed.tab.sales')).click();

  const articles = newsSection().locator('article');
  const empty = newsSection().getByText(t('newsFeed.empty'));

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
