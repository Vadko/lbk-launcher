import { QueryClient } from '@tanstack/query-core';
import { describe, expect, it } from 'vitest';
import { achievementQueryAppId, hookAchievementQueries } from './achievement-query-cache';
import type { AchText } from './achievement-text';
import { steamBetaAchievements as fixture } from './steam-beta-achievements.fixture';

type Schema = typeof fixture.schema;

const JACKBOX = 1552350;
const [FOOL, COLORS] = fixture.schema.groups[0].achievements.map((a) => a.api_name);
const v1: Record<string, AchText> = {
  [FOOL]: { name: 'Обдури мене тричі', desc: 'Обдуріть одного гравця тричі за гру' },
  [COLORS]: { name: 'Очисник палітри' },
};
const v2: Record<string, AchText> = { [FOOL]: { name: 'Тричі обдурений' } };

const schemaKey = ['achievements', JACKBOX, 'schema'];
const byStatusKey = ['achievements', JACKBOX, 'by_status', '<steamid>', 1, 2, 3];
const steamText = fixture.schema.groups[0].achievements.map((a) => [
  a.api_name,
  a.name,
  a.description,
]);

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

  it('restores Steam text and stops listening on dispose', async () => {
    const { client, flush, load, queries } = setup();
    await load(schemaKey, fixture.schema);
    queries.dispose();
    expect(shown(client.getQueryData(schemaKey))).toEqual(steamText);

    await client.refetchQueries({ queryKey: schemaKey });
    flush();
    expect(shown(client.getQueryData(schemaKey))).toEqual(steamText);
  });
});
