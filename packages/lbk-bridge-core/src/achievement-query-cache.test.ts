import { dehydrate, hydrate, QueryClient, QueryObserver } from '@tanstack/query-core';
import { describe, expect, it } from 'vitest';
import { achievementQueryAppId, hookAchievementQueries } from './achievement-query-cache';
import type { AchText } from './achievement-text';
import { steamBetaAchievements as fixture } from './steam-beta-achievements.fixture';

type Schema = typeof fixture.schema;

const JACKBOX = 1552350;
const [FOOL, COLORS] = fixture.schema.groups[0].achievements.map((a) => a.api_name);
const v1: Record<string, AchText> = {
  [FOOL]: { name: 'LBK: Fool me thrice', desc: 'LBK: Fool one player thrice in a game' },
  [COLORS]: { name: 'LBK: Palette cleaner' },
};
const v2: Record<string, AchText> = { [FOOL]: { name: 'LBK: Fooled thrice' } };

const schemaKey = ['achievements', JACKBOX, 'schema'];
const otherApp = ['achievements', 10, 'schema'];
const byStatusKey = ['achievements', JACKBOX, 'by_status', '<steamid>', 1, 2, 3];
const steamText = fixture.schema.groups[0].achievements.map((a) => [
  a.api_name,
  a.name,
  a.description,
]);
const translated = [FOOL, v1[FOOL].name, v1[FOOL].desc];

// [api_name, name, description] of every achievement record in a query's data.
const shown = (data: unknown): unknown[][] => {
  const out: unknown[][] = [];
  JSON.stringify(data, (_key, value: unknown) => {
    if (typeof value === 'object' && value !== null && 'api_name' in value) {
      const rec = value as Record<string, unknown>;
      out.push([rec.api_name, rec.name, rec.description]);
    }
    return value;
  });
  return out;
};

function setup(client = steamClient()) {
  let strings: Record<string, AchText> | null = v1;
  const tasks: (() => void)[] = [];
  const queries = hookAchievementQueries(
    client,
    (appid) => strings !== null && String(appid) === String(JACKBOX),
    (appid, id) =>
      String(appid) === String(JACKBOX) ? strings?.[String(id)] : undefined,
    (fn) => tasks.push(fn)
  );
  const flush = () => {
    for (const task of tasks.splice(0)) {
      task();
    }
  };
  return {
    client,
    queries,
    flush,
    async load(queryKey: unknown[], data: unknown) {
      await client.fetchQuery({ queryKey, queryFn: () => structuredClone(data) });
      flush();
    },
    // What replaceData does after achievements.json changes.
    setStrings(next: Record<string, AchText> | null) {
      strings = next;
      queries.sync(new Set([String(JACKBOX)]));
    },
  };
}

// First record of every result an observer receives.
function watch(client: QueryClient, queryKey: unknown[]) {
  const observer = new QueryObserver(client, {
    queryKey,
    queryFn: () => structuredClone(fixture.schema),
  });
  const results: unknown[] = [];
  const unsubscribe = observer.subscribe(({ data }) => {
    if (data !== undefined) {
      results.push(shown(data)[0]);
    }
  });
  return { observer, results, unsubscribe };
}

// What a server render hands the page: Steam's text, stamped as of dataUpdatedAt.
async function dehydrated(queryKey: unknown[], dataUpdatedAt: number) {
  const server = steamClient();
  await server.fetchQuery({ queryKey, queryFn: () => structuredClone(fixture.schema) });
  const state = dehydrate(server);
  state.queries[0].state.dataUpdatedAt = dataUpdatedAt;
  return { state, data: state.queries[0].state.data };
}

function steamClient() {
  return new QueryClient({
    defaultOptions: { queries: { staleTime: Infinity, gcTime: Infinity } },
  });
}

describe('achievementQueryAppId', () => {
  it('reads the app id from every achievements key the beta builds', () => {
    for (const key of fixture.queryKeys) {
      expect(achievementQueryAppId(key)).toBe(JACKBOX);
    }
    expect(achievementQueryAppId(['PinnedAchievements', JACKBOX])).toBeUndefined();
    expect(achievementQueryAppId('achievements')).toBeUndefined();
  });
});

describe('hookAchievementQueries', () => {
  it('translates fetched data and leaves the query state Steam relies on', async () => {
    const { client, queries, flush } = setup();
    expect(queries.seen()).toBe(false);
    await client.fetchQuery({
      queryKey: schemaKey,
      queryFn: () => structuredClone(fixture.schema),
    });
    const before = client.getQueryState<Schema>(schemaKey);
    flush();

    const after = client.getQueryState<Schema>(schemaKey);
    expect(shown(after?.data)).toEqual([
      [FOOL, v1[FOOL].name, v1[FOOL].desc],
      [COLORS, v1[COLORS].name, steamText[1][2]],
      steamText[2],
    ]);
    expect(after).toMatchObject({
      dataUpdatedAt: before?.dataUpdatedAt,
      dataUpdateCount: before?.dataUpdateCount,
      isInvalidated: false,
    });
    expect(after?.data?.groups[0].achievements[2]).toBe(
      before?.data?.groups[0].achievements[2]
    );
    expect(queries.seen()).toBe(true);
  });

  it('adds no text to records that had none and skips other apps and queries', async () => {
    const { client, load } = setup();
    const progress = { achievements: [{ api_name: FOOL, unlocked: true }] };
    const otherApp = ['achievements', 10, 'schema'];
    const storeItem = ['StoreItem', JACKBOX];
    await load(['achievements', JACKBOX, 'user_achievements', '<steamid>'], progress);
    await load(otherApp, fixture.schema);
    await load(storeItem, fixture.schema);

    expect(
      client.getQueryData(['achievements', JACKBOX, 'user_achievements', '<steamid>'])
    ).toStrictEqual(progress);
    expect(client.getQueryData(otherApp)).toStrictEqual(fixture.schema);
    expect(client.getQueryData(storeItem)).toStrictEqual(fixture.schema);
  });

  it('restores Steam text in copies Steam built from translated data', async () => {
    const { client, flush, load, setStrings } = setup();
    await load(schemaKey, fixture.schema);
    await client.fetchQuery({
      queryKey: byStatusKey,
      queryFn: () => ({
        locked: client
          .getQueryData<Schema>(schemaKey)
          ?.groups[0].achievements.slice(0, 1),
      }),
    });
    client.setQueryData<Schema>(schemaKey, (old) => old && { ...old, schema_version: 4 });
    flush();

    setStrings(null);
    expect(shown(client.getQueryData(schemaKey))).toEqual(steamText);
    expect(shown(client.getQueryData(byStatusKey))).toEqual([steamText[0]]);
  });

  it('switches translations without clearing invalidation or errors', async () => {
    const { client, load, setStrings } = setup();
    await load(schemaKey, fixture.schema);
    await client.invalidateQueries({ queryKey: schemaKey, refetchType: 'none' });
    await client
      .fetchQuery({
        queryKey: schemaKey,
        queryFn: () => Promise.reject(new Error('offline')),
      })
      .catch(() => undefined);

    setStrings(v2);
    expect(client.getQueryState(schemaKey)).toMatchObject({
      status: 'error',
      isInvalidated: true,
    });
    expect(shown(client.getQueryData(schemaKey))).toEqual([
      [FOOL, v2[FOOL].name, steamText[0][2]],
      steamText[1],
      steamText[2],
    ]);

    setStrings(null);
    expect(shown(client.getQueryData(schemaKey))).toEqual(steamText);
  });

  it('translates what Steam loaded before the hook', async () => {
    const client = steamClient();
    await client.fetchQuery({
      queryKey: schemaKey,
      queryFn: () => structuredClone(fixture.schema),
    });
    const { queries } = setup(client);
    queries.sync(null);
    expect(shown(client.getQueryData(schemaKey))[0]).toEqual([
      FOOL,
      v1[FOOL].name,
      v1[FOOL].desc,
    ]);
  });

  it('restores Steam text and setData and stops listening on dispose', async () => {
    const client = steamClient();
    const ownKey = ['achievements', JACKBOX, 'user_achievements', '<steamid>'];
    await client.fetchQuery({ queryKey: ownKey, queryFn: () => ({}) });
    const own = client.getQueryCache().find({ queryKey: ownKey });
    const theirs = own?.setData.bind(own);
    if (own && theirs) {
      own.setData = theirs;
    }
    const { flush, load, queries } = setup(client);
    expect(own?.setData).not.toBe(theirs);
    await load(schemaKey, fixture.schema);
    queries.dispose();
    expect(shown(client.getQueryData(schemaKey))).toEqual(steamText);
    expect(own?.setData).toBe(theirs);
    const query = client.getQueryCache().find({ queryKey: schemaKey });
    expect(Object.hasOwn(query ?? {}, 'setData')).toBe(false);

    await client.refetchQueries({ queryKey: schemaKey });
    flush();
    expect(shown(client.getQueryData(schemaKey))).toEqual(steamText);
  });
});

describe('hookAchievementQueries data written through Query.setData', () => {
  it.each([
    ['a translated app', schemaKey, translated],
    ['an untranslated app', otherApp, steamText[0]],
  ])(
    'reaches observers of %s as stored, across refetch and setQueryData',
    async (_, queryKey, first) => {
      const { client } = setup();
      const { observer, results, unsubscribe } = watch(client, queryKey);
      await observer.refetch();
      await observer.refetch();
      client.setQueryData(queryKey, structuredClone(fixture.schema));
      unsubscribe();

      expect(results.length).toBeGreaterThan(2);
      expect(results).toEqual(results.map(() => first));
    }
  );

  it('translates writes to a query an observer held before the hook', async () => {
    const client = steamClient();
    const { observer, results, unsubscribe } = watch(client, schemaKey);
    await observer.refetch();
    setup(client).queries.sync(null);
    results.length = 0;
    client.setQueryData(schemaKey, structuredClone(fixture.schema));
    await observer.refetch();
    unsubscribe();

    expect(results.length).toBeGreaterThan(1);
    expect(results).toEqual(results.map(() => translated));
  });

  it.each([
    ['removeQueries', (c: QueryClient) => c.removeQueries({ queryKey: schemaKey })],
    ['clear', (c: QueryClient) => c.clear()],
  ])('lets go of a query dropped by %s while observed', async (_, drop) => {
    const { client } = setup();
    const { observer, unsubscribe } = watch(client, schemaKey);
    await observer.refetch();
    const query = client.getQueryCache().find({ queryKey: schemaKey });
    const wrapped = () =>
      ['setData', 'setState'].filter((name) => Object.hasOwn(query ?? {}, name));
    expect(wrapped()).toEqual(['setData', 'setState']);
    drop(client);
    unsubscribe();
    expect(wrapped()).toEqual([]);
  });

  it('keeps the stored data when a refetch brings the same Steam text', async () => {
    const { client, load } = setup();
    await load(schemaKey, fixture.schema);
    const before = client.getQueryData(schemaKey);
    await client.refetchQueries({ queryKey: schemaKey });
    expect(client.getQueryData(schemaKey)).toBe(before);
  });

  it('wraps setData once per hook and lets the next hook wrap it after dispose', async () => {
    const { client, load, queries } = setup();
    await load(schemaKey, fixture.schema);
    const query = client.getQueryCache().find({ queryKey: schemaKey });
    const wrapped = query?.setData;
    await client.refetchQueries({ queryKey: schemaKey });
    expect(query?.setData).toBe(wrapped);

    queries.dispose();
    const next = setup(client);
    expect(Object.hasOwn(query ?? {}, 'setData')).toBe(true);
    expect(query?.setData).not.toBe(wrapped);
    next.queries.dispose();
    expect(Object.hasOwn(query ?? {}, 'setData')).toBe(false);
  });
});

describe('hookAchievementQueries data hydrated into the cache', () => {
  const rows: [string, unknown[], unknown[]][] = [
    ['a translated app', schemaKey, translated],
    ['an untranslated app', otherApp, steamText[0]],
  ];

  it.each(rows)(
    'builds %s hydrated into an empty client as shown',
    async (_, key, first) => {
      const { client } = setup();
      const added: unknown[] = [];
      client.getQueryCache().subscribe((event) => {
        if (event.type === 'added') {
          added.push(shown(event.query.state.data)[0]);
        }
      });
      hydrate(client, (await dehydrated(key, Date.now())).state);
      expect(added).toEqual([first]);
    }
  );

  it.each(rows)(
    'hydrates newer data of %s into a cached query without a frame of Steam text',
    async (_, key, first) => {
      const { client, load } = setup();
      await load(key, fixture.schema);
      const { observer, results, unsubscribe } = watch(client, key);
      const newer = (client.getQueryState(key)?.dataUpdatedAt ?? 0) + 1;
      hydrate(client, (await dehydrated(key, newer)).state);
      const rendered = shown(observer.getCurrentResult().data)[0];
      await new Promise((resolve) => setTimeout(resolve, 0));
      unsubscribe();

      expect(client.getQueryState(key)?.dataUpdatedAt).toBe(newer);
      expect(rendered).toEqual(first);
      expect(results).toEqual([first]);
    }
  );

  it.each([
    ['an empty client', () => Promise.resolve()],
    [
      'a client holding it',
      (s: ReturnType<typeof setup>) => s.load(otherApp, fixture.schema),
    ],
  ])('stores an untranslated app hydrated into %s as is', async (_, before) => {
    const s = setup();
    await before(s);
    const { state, data } = await dehydrated(otherApp, Date.now() + 1);
    hydrate(s.client, state);
    expect(s.client.getQueryData(otherApp)).toBe(data);
  });

  it('gives back setState and build, under a wrapper stacked on top, and Steam text on dispose', async () => {
    const { client, queries } = setup();
    const cache = client.getQueryCache();
    hydrate(client, (await dehydrated(schemaKey, Date.now())).state);
    const query = cache.find({ queryKey: schemaKey });
    expect(Object.hasOwn(query ?? {}, 'setState')).toBe(true);
    const stacked = cache.build.bind(cache);
    cache.build = stacked;
    queries.dispose();

    expect(cache.build).toBe(stacked);
    expect(Object.hasOwn(query ?? {}, 'setState')).toBe(false);
    expect(shown(client.getQueryData(schemaKey))).toEqual(steamText);
    client.clear();
    hydrate(client, (await dehydrated(schemaKey, Date.now())).state);
    expect(shown(client.getQueryData(schemaKey))).toEqual(steamText);
  });
});
