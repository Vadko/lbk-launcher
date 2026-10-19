import { QueryClient } from '@tanstack/query-core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { type PageWindow, startAchievementPage } from './achievement-page';
import type { AppStrings } from './achievement-text';
import { steamCommunityAchievements as fixture } from './steam-community-achievements.fixture';

const GLOBAL_URL = 'https://steamcommunity.com/achievements/620';
const SCHEMA_620 = ['achievements', 620, 'schema'];
const [WAKE] = fixture.portal2Schema.groups[0].achievements;
const PORTAL2: AppStrings = { [WAKE.api_name]: { name: 'Підйом' } };

const hideRules: string[] = [];
class FakeSheet {
  replaceSync(css: string): void {
    hideRules.push(css);
  }
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal('CSSStyleSheet', FakeSheet);
});
afterEach(() => {
  hideRules.length = 0;
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

const advance = (ms: number) => vi.advanceTimersByTimeAsync(ms);

interface PageSetup {
  strings?: AppStrings;
  hydrated?: boolean;
  dehydratedBoundary?: boolean;
  readyState?: DocumentReadyState;
}

// A community page whose root carries the QueryClient next to one Suspense boundary.
function communityPage({
  strings = PORTAL2,
  hydrated = false,
  dehydratedBoundary = false,
  readyState = 'loading',
}: PageSetup = {}) {
  const client = new QueryClient({
    defaultOptions: { queries: { staleTime: Infinity, gcTime: Infinity } },
  });
  client.setQueryData(SCHEMA_620, structuredClone(fixture.portal2Schema));
  const boundary = { memoizedState: { dehydrated: dehydratedBoundary ? {} : null } };
  const tree = {
    memoizedProps: null,
    child: { memoizedProps: {}, child: boundary, sibling: { memoizedProps: { client } } },
  };
  const ssr = { hydrated, reactRoot: { _internalRoot: { current: tree } } };
  const doc: Pick<Document, 'readyState' | 'adoptedStyleSheets'> = {
    readyState,
    adoptedStyleSheets: [],
  };
  const win: PageWindow = {
    location: { href: GLOBAL_URL },
    document: doc as Document,
    SSR: ssr,
  };
  const page = startAchievementPage({ provider: () => Promise.resolve(strings), win });
  return {
    page,
    ssr,
    boundary,
    hidden: () => doc.adoptedStyleSheets.length,
    translated: () => JSON.stringify(client.getQueryData(SCHEMA_620)).includes('Підйом'),
  };
}

describe('achievements page: hydration', () => {
  it('leaves the cache alone while a boundary still holds server HTML after SSR.hydrated', async () => {
    const steam = communityPage({ hydrated: true, dehydratedBoundary: true });
    await advance(500);
    expect(steam.translated()).toBe(false);

    steam.boundary.memoizedState.dehydrated = null;
    await advance(50);
    expect(steam.translated()).toBe(true);
    steam.page?.dispose();
  });
});

describe('achievements page: hide while waiting', () => {
  it('hides the rows and the latest-achievement card of this app only', async () => {
    const steam = communityPage();
    await advance(0);
    expect(steam.hidden()).toBe(1);
    expect(hideRules).toEqual([
      '[data-tableindex]{opacity:0!important}:has(>*>*>img[src*="/images/apps/620/"]){opacity:0!important}',
    ]);
    steam.page?.dispose();
  });

  it.each<[string, (steam: ReturnType<typeof communityPage>) => Promise<unknown>]>([
    [
      '50 ms after the cache is translated',
      async (steam) => {
        steam.ssr.hydrated = true;
        await advance(50);
        expect(steam.translated()).toBe(true);
        expect(steam.hidden()).toBe(1);
        await advance(50);
      },
    ],
    [
      'after 1 s without a client',
      async (steam) => {
        await advance(999);
        expect(steam.hidden()).toBe(1);
        await advance(1);
      },
    ],
    ['on dispose', (steam) => Promise.resolve(steam.page?.dispose())],
  ])('shows the rows again %s', async (_label, settle) => {
    const steam = communityPage();
    await advance(0);
    expect(steam.hidden()).toBe(1);
    await settle(steam);
    expect(steam.hidden()).toBe(0);
    steam.page?.dispose();
  });

  it.each<[string, PageSetup]>([
    ['the app has no strings', { strings: {} }],
    ['the page is already hydrated', { hydrated: true }],
    ['the rows are already parsed', { readyState: 'interactive' }],
  ])('never hides when %s', async (_label, setup) => {
    const steam = communityPage(setup);
    await advance(0);
    expect(steam.hidden()).toBe(0);
    steam.page?.dispose();
  });
});
