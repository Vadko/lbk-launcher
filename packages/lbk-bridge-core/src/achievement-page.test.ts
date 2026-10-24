import { G } from '@mobily/ts-belt';
import { QueryClient } from '@tanstack/query-core';
import { describe, expect, it, vi } from 'vitest';
import { type PageWindow, startAchievementPage } from './achievement-page';
import {
  containerRootFiber,
  findQueryClient,
  hasDehydratedFibers,
  queryClientAbove,
  reactRootFiber,
} from './achievement-page-fiber';
import {
  appStringsInFile,
  buildSourceMap,
  toAppStrings,
} from './achievement-page-sources';
import { matchAchievementPage, PAGE_GLOBAL_KEY } from './achievement-page-url';
import { type AppStrings, sanitizeAchievements } from './achievement-text';
import { steamCommunityAchievements as fixture } from './steam-community-achievements.fixture';

const PAGE_KEY = Symbol.for(PAGE_GLOBAL_KEY);
const GLOBAL_URL = 'https://steamcommunity.com/achievements/620';
const PROFILE_URL = 'https://steamcommunity.com/id/someone/achievements/620/?tab=all';
const SCHEMA_620 = ['achievements', 620, 'schema'];
const SCHEMA_400 = ['achievements', 400, 'schema'];

const [WAKE, MONSTER, LASER] = fixture.portal2Schema.groups[0].achievements;
const [LAB_RAT] = fixture.portalSchema.groups[0].achievements;
const PORTAL2: AppStrings = {
  [WAKE.api_name]: { name: 'LBK: Rise', desc: 'LBK: Survive manual control' },
  [MONSTER.api_name]: { name: 'LBK: What a monster' },
};
const PORTAL: AppStrings = { [LAB_RAT.api_name]: { name: 'LBK: Lab rodent' } };
const STRINGS: Record<string, AppStrings> = { 620: PORTAL2, 400: PORTAL };
const english = fixture.portal2Schema.groups[0].achievements.map((a) => [
  a.api_name,
  a.name,
  a.description,
]);
const translated = [
  [WAKE.api_name, 'LBK: Rise', 'LBK: Survive manual control'],
  [MONSTER.api_name, 'LBK: What a monster', MONSTER.description],
  english[2],
];

// [api_name, name, description] of every achievement record in a query's data.
const shown = (data: unknown): unknown[][] => {
  const out: unknown[][] = [];
  JSON.stringify(data, (_key, value: unknown) => {
    if (G.isObject(value) && 'api_name' in value) {
      out.push([value.api_name, value.name, value.description]);
    }
    return value;
  });
  return out;
};

const fiber = (memoizedProps: unknown, child?: object, sibling?: object) => ({
  memoizedProps,
  child,
  sibling,
});

function ssrWindow(href: string, client: QueryClient): PageWindow {
  const tree = fiber(null, fiber({}, undefined, fiber({ client })));
  return {
    location: { href },
    SSR: { hydrated: true, reactRoot: { _internalRoot: { current: tree } } },
  };
}

function hydratedClient(): QueryClient {
  const client = new QueryClient({
    defaultOptions: { queries: { staleTime: Infinity, gcTime: Infinity } },
  });
  client.setQueryData(SCHEMA_620, structuredClone(fixture.portal2Schema));
  return client;
}

describe('matchAchievementPage', () => {
  const community = { kind: 'community', appid: '620' };
  const store = { kind: 'store', appid: '620' };
  it.each([
    [GLOBAL_URL, community],
    [PROFILE_URL, community],
    [
      'https://steamcommunity.com/profiles/76561197960287930/achievements/620/',
      community,
    ],
    ['https://store.steampowered.com/app/620/Portal_2/?snr=1_5_9__205', store],
    ['https://store.steampowered.com/app/620', store],
    ['http://steamcommunity.com/achievements/620', undefined],
    ['https://steamcommunity.com/achievements/0620', undefined],
    ['https://steamcommunity.com/achievements/620x', undefined],
    ['https://steamcommunity.com/achievements/620/compare', undefined],
    ['https://steamcommunity.com/profiles/me/achievements/620', undefined],
    ['https://steamcommunity.com/stats/620/achievements', undefined],
    ['https://steamcommunity.com.example.net/achievements/620', undefined],
    ['https://store.steampowered.com/app/620/Portal_2/reviews', undefined],
    ['https://store.steampowered.com/achievements/620', undefined],
    ['not a url', undefined],
  ])('%s', (href, expected) => {
    expect(matchAchievementPage(href)).toEqual(expected);
  });
});

describe('buildSourceMap', () => {
  it.each([
    ['a JSON string', fixture.queryData],
    ['an object', JSON.parse(fixture.queryData)],
  ])('maps Steam English to translations from %s', (_label, queryData) => {
    expect(buildSourceMap(queryData, '620', PORTAL2)).toEqual(
      new Map([
        [WAKE.name, 'LBK: Rise'],
        [WAKE.description, 'LBK: Survive manual control'],
        [MONSTER.name, 'LBK: What a monster'],
      ])
    );
  });

  it('drops English that two achievements share unless both read the same', () => {
    const schema = structuredClone(fixture.portal2Schema);
    const [wake, monster, laser] = schema.groups[0].achievements;
    monster.name = wake.name;
    laser.description = wake.description;
    const queryData = { queries: [{ queryKey: SCHEMA_620, state: { data: schema } }] };
    const both = { ...PORTAL2, [MONSTER.api_name]: { name: 'LBK: Rise' } };
    expect(buildSourceMap(queryData, '620', PORTAL2)).toEqual(new Map());
    expect(buildSourceMap(queryData, '620', both)).toEqual(
      new Map([[WAKE.name, 'LBK: Rise']])
    );
  });

  it.each([
    ['another app', fixture.queryData, '400'],
    ['broken JSON', '{"queries":', '620'],
    ['no queries', {}, '620'],
  ])('reads nothing from %s', (_label, queryData, appid) => {
    expect(buildSourceMap(queryData, appid, PORTAL2).size).toBe(0);
  });
});

describe('toAppStrings', () => {
  // A two-byte UTF-8 letter, so the bounds count characters rather than bytes.
  const long = (n: number) => 'é'.repeat(n);

  it.each<[string, unknown, AppStrings | undefined]>([
    ['a blank desc', { A: { name: 'Yes', desc: '' } }, { A: { name: 'Yes' } }],
    [
      'a name that is not a string',
      { A: { name: 5, desc: 'Description' } },
      { A: { desc: 'Description' } },
    ],
    ['an entry that is a string', { A: 'No' }, undefined],
    [
      'an extra key',
      { A: { desc: 'Description', extra: 1 } },
      { A: { desc: 'Description' } },
    ],
    ['an entry without text', { A: {} }, undefined],
    ['strings that are not an object', 'Yes', undefined],
    [
      'a name of 2048 characters',
      { A: { name: long(2048) } },
      { A: { name: long(2048) } },
    ],
    ['a name of 2049 characters', { A: { name: long(2049) } }, undefined],
    [
      'a desc of 4096 characters',
      { A: { desc: long(4096) } },
      { A: { desc: long(4096) } },
    ],
    ['a desc of 4097 characters', { A: { desc: long(4097) } }, undefined],
    [
      'an id of 256 characters',
      { [long(256)]: { name: 'Yes' } },
      { [long(256)]: { name: 'Yes' } },
    ],
    ['an id of 257 characters', { [long(257)]: { name: 'Yes' } }, undefined],
  ])('reads %s', (_label, raw, expected) => {
    expect(toAppStrings(raw)).toEqual(expected);
  });

  it('returns an object without a prototype', () => {
    expect(toAppStrings({ A: { name: 'Yes' } })?.constructor).toBeUndefined();
  });
});

describe('appStringsInFile', () => {
  const file = (apps: unknown, v: unknown = 1) => ({ v, stamp: 's', apps });

  it.each([
    ['one app', file({ 620: PORTAL2, 400: PORTAL }), '620'],
    ['another version', file({ 620: PORTAL2 }, 2), '620'],
    ['an app without strings', file({ 620: PORTAL2 }), '400'],
    ['an app id from the prototype', file({ 620: PORTAL2 }), 'constructor'],
    ['apps that are not an object', file([PORTAL2]), '0'],
    ['an app with blank strings only', file({ 620: { A: { name: '' } } }), '620'],
    ['a file that is not an object', 'achievements', '620'],
    ['a name at the limit', file({ 620: { A: { name: 'é'.repeat(2048) } } }), '620'],
    ['a name over the limit', file({ 620: { A: { name: 'é'.repeat(2049) } } }), '620'],
    ['a desc over the limit', file({ 620: { A: { desc: 'é'.repeat(4097) } } }), '620'],
    [
      'an id over the limit',
      file({ 620: { ['é'.repeat(257)]: { name: 'Yes' } } }),
      '620',
    ],
  ])('reads %s as sanitizeAchievements() does', (_label, raw, appid) => {
    const sanitized = sanitizeAchievements(raw)?.apps[appid];
    expect(appStringsInFile(raw, appid)).toEqual(toAppStrings(sanitized));
  });

  it('keeps the strings of the app it was asked for', () => {
    expect(appStringsInFile(file({ 620: PORTAL2, 400: PORTAL }), '400')).toEqual(PORTAL);
  });
});

describe('fiber walk', () => {
  const client = new QueryClient();

  const decoy = fiber({ client: { getQueryCache: () => null } });
  const tree = fiber(null, fiber({}, decoy, fiber({}, fiber({ client }))));
  const hostRoot = { stateNode: { current: tree } };
  const portalled = { memoizedProps: {}, return: { return: fiber({ client }) } };

  it.each([
    ['below a fiber, past a decoy', () => findQueryClient(tree)],
    [
      'below a hydrateRoot() result',
      () => findQueryClient(reactRootFiber({ _internalRoot: hostRoot.stateNode })),
    ],
    [
      'below a container element',
      () => findQueryClient(containerRootFiber({ __reactContainer$x1: hostRoot })),
    ],
    ['above a portalled node', () => queryClientAbove({ __reactFiber$x1: portalled })],
  ])('finds the provider %s', (_label, find) => {
    expect(find()).toBe(client);
  });

  it.each([
    ['a root still hydrating', { memoizedState: { isDehydrated: true } }, true],
    [
      'a boundary holding server HTML',
      fiber(null, fiber({}, { memoizedState: { dehydrated: {} } })),
      true,
    ],
    ['a hydrated tree', fiber(null, { memoizedState: { dehydrated: null } }), false],
  ])('tells %s', (_label, root, dehydrated) => {
    expect(hasDehydratedFibers(root)).toBe(dehydrated);
  });

  it('stops at the walk limit', () => {
    let chain = fiber({ client });
    for (let i = 0; i < 20_000; i += 1) {
      chain = fiber({}, undefined, chain);
    }
    expect(findQueryClient(chain)).toBeUndefined();
    expect(findQueryClient(undefined)).toBeUndefined();
  });
});

describe('startAchievementPage', () => {
  it('translates the hydrated cache and asks for apps it adds later', async () => {
    const client = hydratedClient();
    const provider = vi.fn((appid: string) => Promise.resolve(STRINGS[appid]));
    const win = ssrWindow(GLOBAL_URL, client);
    const page = startAchievementPage({ provider, win });

    await vi.waitFor(() =>
      expect(shown(client.getQueryData(SCHEMA_620))).toEqual(translated)
    );
    await client.fetchQuery({
      queryKey: SCHEMA_400,
      queryFn: () => structuredClone(fixture.portalSchema),
    });
    await vi.waitFor(() =>
      expect(shown(client.getQueryData(SCHEMA_400))).toEqual([
        [LAB_RAT.api_name, 'LBK: Lab rodent', LAB_RAT.description],
      ])
    );
    expect(provider.mock.calls).toEqual([['620'], ['400']]);

    page?.dispose();
    expect(shown(client.getQueryData(SCHEMA_620))).toEqual(english);
    expect(shown(client.getQueryData(SCHEMA_400))[0][1]).toBe(LAB_RAT.name);
    expect(Reflect.get(win, PAGE_KEY)).toBeUndefined();
  });

  it('waits for a host push and switches strings without losing Steam text', async () => {
    const client = hydratedClient();
    const win = ssrWindow(PROFILE_URL, client);
    const page = startAchievementPage({ win });
    const wanted = vi.fn();
    page?.onWanted(wanted);
    expect(startAchievementPage({ win })).toBe(page);
    expect(wanted).toHaveBeenCalledWith('620');

    page?.provide('620', PORTAL2);
    await vi.waitFor(() =>
      expect(shown(client.getQueryData(SCHEMA_620))).toEqual(translated)
    );
    expect(page?.wanted()).toEqual([]);

    page?.provide('620', { [WAKE.api_name]: { name: 'LBK: Wake up' } });
    expect(shown(client.getQueryData(SCHEMA_620))).toEqual([
      [WAKE.api_name, 'LBK: Wake up', WAKE.description],
      english[1],
      [LASER.api_name, LASER.name, LASER.description],
    ]);
    page?.provide('620', undefined);
    expect(shown(client.getQueryData(SCHEMA_620))).toEqual(english);
    page?.dispose();
  });

  it('replaces an older copy and stays out of other pages', () => {
    const older = { version: 0, dispose: vi.fn() };
    const win: PageWindow = { location: { href: GLOBAL_URL } };
    Object.defineProperty(win, PAGE_KEY, { value: older, configurable: true });
    const page = startAchievementPage({ win });
    expect(older.dispose).toHaveBeenCalledOnce();
    expect(Reflect.get(win, PAGE_KEY)).toBe(page);
    page?.dispose();

    const other: PageWindow = {
      location: { href: 'https://help.steampowered.com/en/' },
      navigation: new EventTarget(),
    };
    expect(startAchievementPage({ win: other })).toBeUndefined();
    expect(Reflect.get(other, PAGE_KEY)).toBeUndefined();
  });
});

const GAMES_URL = 'https://steamcommunity.com/id/someone/games/?tab=all';

// A hydrated community document that the app's own router moves to another URL.
function routedWindow(href: string, client: QueryClient) {
  const navigation = new EventTarget();
  const win: PageWindow = { ...ssrWindow(href, client), navigation };
  const navigate = (next: string) => {
    win.location.href = next;
    navigation.dispatchEvent(new Event('currententrychange'));
  };
  return { win, navigation, navigate };
}

describe('startAchievementPage on a client-side navigation', () => {
  it('waits on another page of the site and starts once, on the first achievements page', async () => {
    const client = hydratedClient();
    const provider = vi.fn((appid: string) => Promise.resolve(STRINGS[appid]));
    const { win, navigation, navigate } = routedWindow(GAMES_URL, client);
    const listen = vi.spyOn(navigation, 'addEventListener');
    const unlisten = vi.spyOn(navigation, 'removeEventListener');
    const page = startAchievementPage({ provider, win });
    expect(startAchievementPage({ provider, win })).toBe(page);
    expect(Reflect.get(win, PAGE_KEY)).toBe(page);

    navigate('https://steamcommunity.com/id/someone/games/?tab=recent');
    navigate('https://steamcommunity.com/id/someone/achievements/620/compare');
    expect(provider).not.toHaveBeenCalled();
    navigate(PROFILE_URL);
    expect(provider.mock.calls).toEqual([['620']]);
    expect(listen).toHaveBeenCalledOnce();
    expect(unlisten).toHaveBeenCalledWith('currententrychange', listen.mock.calls[0][1]);
    await vi.waitFor(() =>
      expect(shown(client.getQueryData(SCHEMA_620))).toEqual(translated)
    );

    // Another game's page comes through the query cache, as it does for a document that opened on one.
    navigate('https://steamcommunity.com/id/someone/achievements/400');
    await client.fetchQuery({
      queryKey: SCHEMA_400,
      queryFn: () => structuredClone(fixture.portalSchema),
    });
    await vi.waitFor(() => expect(provider.mock.calls).toEqual([['620'], ['400']]));
    page?.dispose();
    expect(shown(client.getQueryData(SCHEMA_620))).toEqual(english);
  });

  it('asks a host that pushes strings once the navigation reaches an achievements page', async () => {
    const client = hydratedClient();
    const { win, navigate } = routedWindow(GAMES_URL, client);
    const page = startAchievementPage({ hint: new Set(['620']), win });
    const wanted = vi.fn();
    page?.onWanted(wanted);
    expect(page?.wanted()).toEqual([]);

    navigate(GLOBAL_URL);
    expect(wanted.mock.calls).toEqual([['620']]);
    page?.provide('620', PORTAL2);
    await vi.waitFor(() =>
      expect(shown(client.getQueryData(SCHEMA_620))).toEqual(translated)
    );
    expect(page?.wanted()).toEqual([]);
    page?.dispose();
  });

  it('stops waiting on dispose', () => {
    const provider = vi.fn((appid: string) => Promise.resolve(STRINGS[appid]));
    const { win, navigate } = routedWindow(GAMES_URL, hydratedClient());
    startAchievementPage({ provider, win })?.dispose();
    navigate(GLOBAL_URL);
    expect(provider).not.toHaveBeenCalled();
    expect(Reflect.get(win, PAGE_KEY)).toBeUndefined();
  });

  it.each([
    ['another origin', 'https://store.steampowered.com.evil.test/app/620', true],
    ['a document that cannot follow its navigations', GAMES_URL, false],
  ])('stays out of %s', (_label, href, routed) => {
    const navigation = new EventTarget();
    const listen = vi.spyOn(navigation, 'addEventListener');
    const win: PageWindow = routed
      ? { location: { href }, navigation }
      : { location: { href } };
    expect(startAchievementPage({ win })).toBeUndefined();
    expect(listen).not.toHaveBeenCalled();
    expect(Reflect.get(win, PAGE_KEY)).toBeUndefined();
  });
});
