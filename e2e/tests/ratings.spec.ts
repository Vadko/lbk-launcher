import { expect, type Page, test } from '@playwright/test';
import { type AppInstance, launchApp, waitForAppReady } from '../helpers/launch';
import { t } from '../../src/shared/i18n/i18n';

let instance: AppInstance;
let page: Page;

const openRatings = async () => {
  await page.getByTitle(t('sidebarNav.ratings')).click();
  await page.getByRole('heading', { name: t('ratings.title') }).waitFor({ state: 'visible' });
};

test.beforeAll(async () => {
  instance = await launchApp();
  page = instance.page;
  await waitForAppReady(page);
  await openRatings();
});

test.afterAll(async () => {
  await instance?.close();
});

const tab = (kind: 'teams' | 'games') =>
  page.getByRole('button', { name: t(`ratings.tab.${kind}`), exact: true });

const table = (kind: 'teams' | 'games') =>
  page.getByRole('table', { name: t(`ratings.caption.${kind}`) });

const rowsOrEmpty = async (kind: 'teams' | 'games') => {
  const rows = table(kind)
    .getByRole('row')
    .filter({ has: page.getByRole('button', { name: t('ratings.details') }) });
  const empty = page.getByText(t('ratings.empty'));
  await expect
    .poll(
      async () => {
        const hasRows = (await rows.count()) > 0;
        const isEmpty = await empty.isVisible().catch(() => false);
        return hasRows || isEmpty;
      },
      { timeout: 10_000 }
    )
    .toBe(true);
  return rows;
};

test('ratings page shows its heading and both tabs', async () => {
  await expect(page.getByRole('heading', { name: t('ratings.title') })).toBeVisible();
  await expect(tab('teams')).toBeVisible();
  await expect(tab('games')).toBeVisible();
  await expect(tab('teams')).toHaveAttribute('aria-pressed', 'true');
});

test('teams tab lists teams or the empty state', async () => {
  await expect(table('teams')).toBeVisible();
  await rowsOrEmpty('teams');
});

test('the next page continues the ranks', async () => {
  await tab('games').click();
  const rows = await rowsOrEmpty('games');
  const next = page.getByRole('button', { name: t('pagination.next') });
  if (!(await next.isVisible())) {
    return;
  }

  await next.click();
  await expect(page.getByRole('button', { name: '2', exact: true })).toHaveAttribute(
    'aria-current',
    'page'
  );
  await expect(rows.first().getByRole('rowheader')).toHaveText('11');
  await page.getByRole('button', { name: t('pagination.first') }).click();
  await expect(rows.first().getByRole('rowheader')).toHaveText('1');
  await tab('teams').click();
});

test('games tab lists games, and a row opens its game', async () => {
  await tab('games').click();
  await expect(tab('games')).toHaveAttribute('aria-pressed', 'true');
  const rows = await rowsOrEmpty('games');
  if ((await rows.count()) === 0) {
    return;
  }

  await rows.first().getByRole('button', { name: t('ratings.details') }).click();
  await expect(page.getByRole('heading', { name: t('ratings.title') })).not.toBeVisible();
  // GameTabs is the only tablist in the app
  await expect(page.getByRole('tablist')).toBeVisible();
});

test('a team row leaves the ratings for the catalog', async () => {
  await openRatings();
  const rows = await rowsOrEmpty('teams');
  if ((await rows.count()) === 0) {
    return;
  }

  await rows.first().getByRole('button', { name: t('ratings.details') }).click();
  await expect(page.getByRole('heading', { name: t('ratings.title') })).not.toBeVisible();
  // The author filter persists in the profile the next specs start from
  await page.getByTitle(t('filterBar.clearAll')).click();
});
