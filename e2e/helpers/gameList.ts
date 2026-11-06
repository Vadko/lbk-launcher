import type { Page } from '@playwright/test';

// The sidebar renders only the rows on screen, so the list size comes from aria-setsize
export async function gameListSize(page: Page): Promise<number> {
  const row = page.locator('[role="listitem"][aria-setsize]').first();
  return (await row.count()) === 0 ? 0 : Number(await row.getAttribute('aria-setsize'));
}
