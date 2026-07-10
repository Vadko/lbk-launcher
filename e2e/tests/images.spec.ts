import * as fs from 'fs';
import { expect, test } from '@playwright/test';
import { launchApp, waitForAppReady } from '../helpers/launch';

/**
 * Регресійний тест завантаження картинок: після різкого скролу вглиб списку
 * черга image-запитів не забивається, а банер GamePage завантажується.
 * (Регресія: preload банерів по видимості давав 240+ запитів у черзі,
 * і банер шапки не з'являвся.)
 *
 * IMGDBG=1 — додатково друкує повний CDP-таймлайн кожного image-запиту.
 */

test('images: hero banner loads after deep scroll, no request pileup', async () => {
  test.setTimeout(120_000);

  const app = await launchApp();
  const { page } = app;

  type Req = {
    url: string;
    created: number;
    done?: number;
    failed?: string;
    canceled?: boolean;
    status?: number;
    priority?: string;
  };
  const reqs = new Map<string, Req>();
  const t0 = Date.now();
  const rel = (wall: number) => Math.round(wall - t0);

  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Network.enable');
  cdp.on('Network.requestWillBeSent', (e) => {
    if (e.type !== 'Image') return;
    reqs.set(e.requestId, {
      url: e.request.url.split('/').slice(-2).join('/').slice(0, 60),
      created: rel(e.wallTime * 1000),
      priority: e.request.initialPriority,
    });
  });
  cdp.on('Network.responseReceived', (e) => {
    const r = reqs.get(e.requestId);
    if (r) r.status = e.response.status;
  });
  cdp.on('Network.loadingFinished', (e) => {
    const r = reqs.get(e.requestId);
    if (r) r.done = rel(Date.now());
  });
  cdp.on('Network.loadingFailed', (e) => {
    const r = reqs.get(e.requestId);
    if (r) {
      r.failed = e.errorText;
      r.canceled = e.canceled;
      r.done = rel(Date.now());
    }
  });

  await waitForAppReady(page);
  await page.waitForTimeout(1500); // початкові картинки

  // Різкий скрол: стрибок скролбаром углиб + короткий флік
  await page.evaluate(async () => {
    const scroller = document.querySelector('.custom-scrollbar.flex-1');
    if (!scroller) return;
    scroller.scrollTop = 35000;
    await new Promise((r) => setTimeout(r, 120));
    for (let step = 0; step < 8; step++) {
      scroller.scrollTop += 700;
      await new Promise((r) => setTimeout(r, 30));
    }
  });
  await page.waitForTimeout(800); // isScrolling settle + фетчі видимого вікна

  // Клік по видимій глибокій грі → банер шапки має завантажитись
  await page.locator('[data-nav-group="game-list"]:visible').first().click();

  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const img = document.querySelector(
            '.h-\\[300px\\] img'
          ) as HTMLImageElement | null;
          // або банер завантажився, або гра легітимно без банера (плейсхолдер без img)
          if (!img) return document.querySelector('.h-\\[300px\\]') ? 'no-banner' : null;
          return img.complete && img.naturalWidth > 0 ? 'loaded' : 'loading';
        }),
      { timeout: 15_000 }
    )
    .not.toBe('loading');

  await page.waitForTimeout(2000); // дати хвостам завершитись

  const list = [...reqs.values()];
  const pending = list.filter((r) => !r.done);
  const failed = list.filter((r) => r.failed && !r.canceled);

  if (process.env.IMGDBG) {
    for (const r of list.sort((a, b) => a.created - b.created)) {
      const state = r.failed
        ? `FAILED ${r.failed}${r.canceled ? ' (canceled)' : ''}`
        : r.done
          ? `ok ${r.status}`
          : 'PENDING';
      console.log(`  +${r.created}ms pri=${r.priority} ${state} ${r.url}`);
    }
    fs.mkdirSync('perf-artifacts', { recursive: true });
  }
  console.log(
    `[images] total=${list.length} pending=${pending.length} failed=${failed.length}`
  );

  // Черга не забита сотнями фонових завантажень (регресія: 150+ pending)
  expect(pending.length).toBeLessThan(30);
  // Жодного реального мережевого фейлу (скасовані при демонтажі — легітимні)
  expect(failed).toEqual([]);

  await app.close();
});
