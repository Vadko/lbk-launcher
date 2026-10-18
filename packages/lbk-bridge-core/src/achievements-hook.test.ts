import { afterEach, describe, expect, it } from 'vitest';
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

const hooks: AchievementsHook[] = [];
afterEach(() => {
  for (const hook of hooks.splice(0)) {
    hook.uninstall();
  }
});

function makeSteam(disk: Map<unknown, string>) {
  const cache = new FakeAppDetailsCache(disk);
  const rendered: { achievements?: unknown } = {};
  const steam: SteamGlobals = {
    appDetailsCache: cache,
    appDetailsStore: { GetAppDetails: () => rendered },
    webpackChunksteamui: [],
  };
  steam.window = steam;
  const hook = installAchievementsHook(steam);
  hooks.push(hook);
  hook.replaceData({ stamp: '1', apps: { [APP]: { WITCH: UK } } });
  return { cache, rendered };
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
