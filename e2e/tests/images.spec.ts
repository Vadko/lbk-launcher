import * as fs from 'fs';
import { expect, test } from '@playwright/test';
import { launchApp, waitForAppReady } from '../helpers/launch';

/**
 * Image-loading regression test: after a sharp scroll deep into the list the
 * image request queue does not clog, and the GamePage banner still loads.
 * (Regression: preloading banners by visibility produced 240+ queued requests,
 * and the header banner never appeared.)
 *
 * IMGDBG=1 additionally prints the full CDP timeline of every image request.
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

  // Sharp scroll: a scrollbar jump deep into the list plus a short flick
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

  // Click a visible deep game → the header banner must load
  await page.locator('[data-nav-group="game-list"]:visible').first().click();

  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const img = document.querySelector(
            '.h-\\[300px\\] img'
          ) as HTMLImageElement | null;
          // either the banner loaded, or the game legitimately has none (placeholder, no img)
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

  // The queue is not clogged with hundreds of background loads (regression: 150+ pending)
  expect(pending.length).toBeLessThan(30);
  // No real network failures (ones cancelled on unmount are legitimate)
  expect(failed).toEqual([]);

  await app.close();
});
