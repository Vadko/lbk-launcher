import { test, expect, type Page } from '@playwright/test';
import { BUTTON, connectGamepad, press } from '../helpers/gamepad';
import { launchApp, waitForAppReady, type AppInstance } from '../helpers/launch';
import { t } from '../../src/shared/i18n/i18n';

let instance: AppInstance;
let page: Page;

interface Selection {
  inBar: boolean;
  isPrimary: boolean;
  top: number;
  barBottom: number;
  isBarStuck: boolean;
}

// The selection as the gamepad loop sees it, against the game page's sticky actions bar
const selection = () =>
  page.evaluate((): Selection => {
    const roots = document.querySelectorAll<HTMLElement>('[data-gamepad-main-content]');
    const root = roots[roots.length - 1];
    const bar = root.querySelector<HTMLElement>('[data-gamepad-sticky]');
    const el =
      document.querySelector<HTMLElement>('[data-gamepad-selected]') ??
      (document.activeElement as HTMLElement);
    if (!bar) {
      throw new Error('No sticky actions bar on the page');
    }
    const barRect = bar.getBoundingClientRect();
    const stuckAt =
      root.getBoundingClientRect().top + Number.parseFloat(getComputedStyle(root).paddingTop);
    return {
      inBar: bar.contains(el),
      isPrimary: el.hasAttribute('data-gamepad-primary-action'),
      top: el.getBoundingClientRect().top,
      barBottom: barRect.bottom,
      isBarStuck: Math.abs(barRect.top - stuckAt) <= 1,
    };
  });

const isBelowBar = (s: Selection) => !s.inBar && s.top >= s.barBottom - 1;

test.beforeAll(async () => {
  instance = await launchApp();
  page = instance.page;
  await waitForAppReady(page);
  // Opened with the mouse before the pad connects: any mouse move leaves gamepad mode
  await page.locator('[data-nav-group="game-list"]').first().click();
  await page.locator('[data-gamepad-sticky]').waitFor({ state: 'visible' });
  // The install check keeps the primary action disabled for a moment, and entering would then select something else
  await expect(page.locator('[data-gamepad-primary-action]').first()).toBeEnabled();
  await connectGamepad(page);
  // Gamepad mode swaps the sidebar for the strip; the navigation loop runs only once that layout is up
  await page.locator('[data-gamepad-game-list]').waitFor({ state: 'visible' });
});

test.afterAll(async () => {
  await instance?.close();
});

test('entering the game page selects its primary action', async () => {
  await press(page, BUTTON.DOWN);
  await expect.poll(selection).toMatchObject({ inBar: true, isPrimary: true });
});

test('with the actions bar stuck, moving down selects what is below the bar', async () => {
  await press(page, BUTTON.RT);
  await press(page, BUTTON.RT);
  await expect.poll(async () => (await selection()).isBarStuck).toBe(true);

  await press(page, BUTTON.DOWN);
  await expect.poll(async () => isBelowBar(await selection())).toBe(true);
});

test('moving up never selects what the stuck bar covers', async () => {
  for (let step = 0; step < 12; step++) {
    await press(page, BUTTON.UP);
    await page.waitForTimeout(400);
    const s = await selection();
    expect(s.inBar || s.top >= s.barBottom - 1).toBe(true);
    if (s.inBar) {
      break;
    }
  }
});

test('coming back to the page under a stuck bar starts below it', async () => {
  await press(page, BUTTON.RT);
  await press(page, BUTTON.RT);
  await expect.poll(async () => (await selection()).isBarStuck).toBe(true);

  await press(page, BUTTON.B);
  await press(page, BUTTON.DOWN);
  await expect.poll(async () => isBelowBar(await selection())).toBe(true);
});

test('picking the reviews tab shows its panel below the stuck bar', async () => {
  await page.getByRole('tab', { name: t('gameTabs.reviews') }).focus();
  await press(page, BUTTON.A);

  const reviews = page.locator('[data-gamepad-main-content] section', {
    hasText: t('gameReviews.installRequired'),
  });
  await expect(reviews).toBeVisible();
  await expect
    .poll(async () => {
      const box = await reviews.boundingBox();
      const s = await selection();
      return !!box && s.isBarStuck && box.y >= s.barBottom - 1;
    })
    .toBe(true);
});
