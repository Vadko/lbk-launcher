import { afterEach, describe, expect, it, vi } from 'vitest';
import { type AchievementsHook, installAchievementsHook } from './achievements-hook';
import type { SteamGlobals } from './steam-globals';

const APP = 1912410;
const KEY = 'achievements';
const VERSION = 2;
const UK = { name: 'LBK: відьма', desc: 'LBK: опис' };

const steamAchievements = () => ({
  nTotal: 2,
  nAchieved: 1,
  vecHighlight: [
    {
      strID: 'WITCH',
      strName: 'Witch Hunter',
      strDescription: 'Defeat the witch',
      bAchieved: true,
    },
  ],
  vecUnachieved: [
    {
      strID: 'TALISMAN',
      strName: 'Lucky Charm',
      strDescription: 'Upgrade a talisman',
      bAchieved: false,
    },
  ],
  vecAchievedHidden: [],
});

interface CacheEntry {
  version: unknown;
  data: unknown;
}

// Steam's appDetailsCache (sp.js module 17541); every save writes all of the app's keys.
class FakeAppDetailsCache {
  m_mapAppDetailsCache = new Map<unknown, Map<unknown, CacheEntry>>();

  constructor(private readonly disk: Map<unknown, string>) {}

  BHasDataForApp(appid: unknown): boolean {
    return this.m_mapAppDetailsCache.has(appid);
  }

  LookupCachedDataForApp(appid: unknown, key: unknown, version: unknown): unknown {
    const entry = this.m_mapAppDetailsCache.get(appid)?.get(key);
    return entry && entry.version === version ? entry.data : undefined;
  }

  async GetCachedDataForApp(appid: unknown, key: unknown, version: unknown) {
    if (!this.BHasDataForApp(appid)) {
      await this.FetchDataForApp(appid);
    }
    return this.LookupCachedDataForApp(appid, key, version);
  }

  async FetchDataForApp(appid: unknown): Promise<void> {
    const json = await Promise.resolve(this.disk.get(appid) ?? '');
    let saved: [unknown, CacheEntry][] = [];
    try {
      saved = JSON.parse(json);
    } catch {
      // Steam starts an empty map for an app it never cached.
    }
    this.m_mapAppDetailsCache.set(appid, new Map(saved));
  }

  SetCachedDataForApp(appid: unknown, key: unknown, version: unknown, data: unknown) {
    const entries =
      this.m_mapAppDetailsCache.get(appid) ?? new Map<unknown, CacheEntry>();
    this.m_mapAppDetailsCache.set(appid, entries);
    entries.set(key, { version, data });
    this.disk.set(appid, JSON.stringify([...entries]));
    return Promise.resolve();
  }
}

type Rec = Record<string, unknown>;

interface NewsAchievements {
  appid: number;
  achievements: { name: string; display_name: string; display_description: string }[];
}

// The activity class (sp.js module 15983); MergeUserNews looks the static builder up on the class.
class FakeActivity {
  m_AchievementMap = new Map<number, Map<string, Rec>>();

  static BuildAchievementMapFromProto(
    map: Map<string, Rec>,
    _appid: number,
    news: NewsAchievements
  ) {
    for (const a of news.achievements) {
      map.set(a.name, {
        strName: a.display_name,
        strDescription: a.display_description,
        strID: a.name,
      });
    }
  }

  MergeUserNews(news: NewsAchievements) {
    const map = this.m_AchievementMap.get(news.appid) ?? new Map<string, Rec>();
    this.m_AchievementMap.set(news.appid, map);
    FakeActivity.BuildAchievementMapFromProto(map, news.appid, news);
  }
}

class FakeActivityStore {
  m_mapAppActivity = new Map<number, FakeActivity>();

  FetchActivityHistory(appid: number, news: NewsAchievements) {
    this.m_mapAppActivity.get(appid)?.MergeUserNews(news);
    return Promise.resolve();
  }

  FetchLatestActivityFromServer(appid: number, news: NewsAchievements) {
    return this.FetchActivityHistory(appid, news);
  }
}

const witchNews = (): NewsAchievements => ({
  appid: APP,
  achievements: [
    {
      name: 'WITCH',
      display_name: 'Witch Hunter',
      display_description: 'Defeat the witch',
    },
  ],
});

const hooks: AchievementsHook[] = [];
afterEach(() => {
  for (const hook of hooks.splice(0)) {
    hook.uninstall();
  }
});

function makeSteam(disk: Map<unknown, string>, activity?: FakeActivityStore) {
  const cache = new FakeAppDetailsCache(disk);
  const rendered: { achievements?: unknown } = {};
  const steam: SteamGlobals = {
    appDetailsCache: cache,
    appDetailsStore: { GetAppDetails: () => rendered },
    appActivityStore: activity,
    webpackChunksteamui: [],
  };
  steam.window = steam;
  const hook = installAchievementsHook(steam);
  hooks.push(hook);
  hook.replaceData({ stamp: '1', apps: { [APP]: { WITCH: UK } } });
  return { steam, cache, rendered, hook };
}

const translatedRead = {
  vecHighlight: [{ strID: 'WITCH', strName: UK.name, strDescription: UK.desc }],
  vecUnachieved: [{ strID: 'TALISMAN', strName: 'Lucky Charm' }],
};

describe('achievements in the app details cache', () => {
  it('saves Steam strings while the details on screen and later reads are translated', async () => {
    const disk = new Map<unknown, string>();
    const { cache, rendered } = makeSteam(disk);

    // AppDetailsChanged (sp.js module 32558): the store copies the details, then the cache saves them.
    const fromSteam = steamAchievements();
    rendered.achievements = structuredClone(fromSteam);
    await cache.SetCachedDataForApp(APP, KEY, VERSION, fromSteam);

    expect(rendered).toMatchObject({ achievements: translatedRead });
    expect(disk.get(APP)).toContain('Witch Hunter');
    expect(disk.get(APP)).not.toContain('LBK');
    expect(await cache.GetCachedDataForApp(APP, KEY, VERSION)).toMatchObject(
      translatedRead
    );

    await cache.SetCachedDataForApp(APP, 'descriptions', 1, { strSnippet: 'Snippet' });
    expect(disk.get(APP)).toContain('Witch Hunter');
    expect(disk.get(APP)).not.toContain('LBK');
  });

  it('translates what an earlier session saved without writing the translation back', async () => {
    const saved = [[KEY, { version: VERSION, data: steamAchievements() }]];
    const disk = new Map<unknown, string>([[APP, JSON.stringify(saved)]]);
    const { cache } = makeSteam(disk);

    expect(await cache.GetCachedDataForApp(APP, KEY, VERSION)).toMatchObject(
      translatedRead
    );
    await cache.SetCachedDataForApp(APP, 'descriptions', 1, { strSnippet: 'Snippet' });
    expect(disk.get(APP)).toContain('Witch Hunter');
    expect(disk.get(APP)).not.toContain('LBK');
  });
});

describe('achievements in activity cards', () => {
  const OWNER = 400;
  const MAP_KEY = 'achievementmap';
  const steamMap = JSON.stringify([
    [
      APP,
      [
        [
          'WITCH',
          { strID: 'WITCH', strName: 'Witch Hunter', strDescription: 'Defeat the witch' },
        ],
      ],
    ],
  ]);

  it('saves Steam text even for a map read before the translation was removed', async () => {
    const disk = new Map([
      [OWNER, JSON.stringify([[MAP_KEY, { version: 1, data: steamMap }]])],
    ]);
    const { cache, hook } = makeSteam(disk);
    const read = await cache.GetCachedDataForApp(OWNER, MAP_KEY, 1);
    expect(read).toContain(UK.name);

    // RestoreCachedActivity parses the map into an activity that is not in the store yet.
    const inFlight: unknown = JSON.parse(String(read));
    hook.replaceData({ stamp: '2', apps: {} });
    await cache.SetCachedDataForApp(OWNER, MAP_KEY, 1, JSON.stringify(inFlight));
    expect(disk.get(OWNER)).toContain('Witch Hunter');
    expect(disk.get(OWNER)).not.toContain('LBK');
  });

  it('translates history merged into an activity restored after the hook', async () => {
    const store = new FakeActivityStore();
    makeSteam(new Map(), store);
    const activity = new FakeActivity();
    store.m_mapAppActivity.set(APP, activity);

    await store.FetchActivityHistory(APP, witchNews());
    expect(activity.m_AchievementMap.get(APP)?.get('WITCH')).toMatchObject({
      strName: UK.name,
      strDescription: UK.desc,
    });
  });

  it('gives back every method it wrapped and Steam text in loaded maps on uninstall', async () => {
    const store = new FakeActivityStore();
    const activity = new FakeActivity();
    store.m_mapAppActivity.set(APP, activity);
    const build = FakeActivity.BuildAchievementMapFromProto;
    const { cache, hook } = makeSteam(new Map(), store);
    await store.FetchLatestActivityFromServer(APP, witchNews());
    expect(activity.m_AchievementMap.get(APP)?.get('WITCH')?.strName).toBe(UK.name);

    hook.uninstall();
    expect(activity.m_AchievementMap.get(APP)?.get('WITCH')?.strName).toBe(
      'Witch Hunter'
    );
    expect(FakeActivity.BuildAchievementMapFromProto).toBe(build);
    for (const [target, key] of [
      [store, 'FetchActivityHistory'],
      [store, 'FetchLatestActivityFromServer'],
      [cache, 'SetCachedDataForApp'],
      [cache, 'LookupCachedDataForApp'],
    ] as const) {
      expect(Object.hasOwn(target, key)).toBe(false);
    }
  });
});

describe('installAchievementsHook', () => {
  it('replaces a hook left by an earlier plugin version and keeps its own', () => {
    const uninstall = vi.fn();
    const steam: SteamGlobals = { webpackChunksteamui: [] };
    steam.window = steam;
    const stale = { version: 1, replaceData: vi.fn(), report: vi.fn(), uninstall };
    Object.defineProperty(steam, Symbol.for('lbk.achievementStrings'), {
      value: stale,
      configurable: true,
    });

    const hook = installAchievementsHook(steam);
    hooks.push(hook);
    expect(uninstall).toHaveBeenCalledOnce();
    expect(hook).not.toBe(stale);
    expect(installAchievementsHook(steam)).toBe(hook);
  });
});
