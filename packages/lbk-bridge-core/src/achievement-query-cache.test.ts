import { describe, expect, it, vi } from 'vitest';
import {
  achievementQueryAppId,
  hookAchievementQueries,
  type QueryClient,
  translateQueryData,
} from './achievement-query-cache';
import type { AchText } from './achievement-text';
import { steamBetaAchievements as fixture } from './fixtures/steam-beta-achievements';

const JACKBOX = 1552350;
const strings: Record<string, AchText> = {
  DRAWFULANIMATE_FOOL_SAME_PLAYER: {
    name: 'Малювач Анімач: Обдури мене тричі',
    desc: 'Обдуріть одного й того ж гравця тричі за гру',
  },
  DRAWFULANIMATE_USE_ALL_THREE_COLORS: { name: 'Малювач Анімач: Очисник палітри' },
};
const lookup = (appid: unknown, id: unknown): AchText | undefined =>
  String(appid) === String(JACKBOX) ? strings[String(id)] : undefined;
const has = (appid: unknown): boolean => String(appid) === String(JACKBOX);
const copy = <T>(v: T): T => JSON.parse(JSON.stringify(v));

const schemaKey = ['achievements', JACKBOX, 'schema'];
const byStatusKey = ['achievements', JACKBOX, 'by_status', '<steamid>', 1, 2, 3];

interface FakeQuery {
  queryKey: unknown[];
  state: { data: unknown; dataUpdatedAt: number };
}

class FakeQueryClient implements QueryClient {
  queries: FakeQuery[] = [];
  listeners = new Set<(event: unknown) => void>();
  writes: { key: unknown; updatedAt: number }[] = [];

  getQueryCache() {
    return {
      getAll: () => this.queries,
      subscribe: (listener: (event: unknown) => void) => {
        this.listeners.add(listener);
        return () => {
          this.listeners.delete(listener);
        };
      },
    };
  }

  setQueryData(key: unknown, data: unknown, options: { updatedAt: number }): unknown {
    const query = this.find(key);
    if (!query) {
      throw new Error('no query');
    }
    this.writes.push({ key, updatedAt: options.updatedAt });
    query.state = { data, dataUpdatedAt: options.updatedAt };
    this.emit({ type: 'updated', query, action: { type: 'success', manual: true } });
    return data;
  }

  fetched(key: unknown[], data: unknown, updatedAt: number): FakeQuery {
    let query = this.find(key);
    if (!query) {
      query = { queryKey: key, state: { data: undefined, dataUpdatedAt: 0 } };
      this.queries.push(query);
      this.emit({ type: 'added', query });
    }
    query.state = { data, dataUpdatedAt: updatedAt };
    this.emit({ type: 'updated', query, action: { type: 'success' } });
    return query;
  }

  remove(key: unknown[]): void {
    const query = this.find(key);
    this.queries = this.queries.filter((q) => q !== query);
    this.emit({ type: 'removed', query });
  }

  private find(key: unknown): FakeQuery | undefined {
    return this.queries.find((q) => JSON.stringify(q.queryKey) === JSON.stringify(key));
  }

  private emit(event: unknown): void {
    for (const listener of this.listeners) {
      listener(event);
    }
  }
}

function setup() {
  const client = new FakeQueryClient();
  const tasks: (() => void)[] = [];
  const queries = hookAchievementQueries(client, has, lookup, (fn) => tasks.push(fn));
  const flush = () => {
    for (const task of tasks.splice(0)) {
      task();
    }
  };
  return { client, queries, flush };
}

const names = (data: unknown): unknown[] => {
  const out: unknown[] = [];
  JSON.stringify(data, (_key, value: unknown) => {
    if (typeof value === 'object' && value !== null && 'api_name' in value) {
      out.push((value as { name?: unknown }).name);
    }
    return value;
  });
  return out;
};

describe('achievementQueryAppId', () => {
  it('reads the app id from every achievements key the beta builds', () => {
    for (const key of fixture.queryKeys) {
      expect(achievementQueryAppId(key)).toBe(JACKBOX);
    }
    expect(achievementQueryAppId(['PinnedAchievements', JACKBOX])).toBeUndefined();
    expect(achievementQueryAppId('achievements')).toBeUndefined();
  });
});

describe('translateQueryData', () => {
  it('translates a copy of the schema and shares what it did not touch', () => {
    const schema = copy(fixture.schema);
    const before = JSON.stringify(schema);
    const out = translateQueryData(schema, JACKBOX, lookup) as typeof schema;

    expect(JSON.stringify(schema)).toBe(before);
    const [fool, colors, untouched] = out.groups[0].achievements;
    expect(fool).toMatchObject({
      api_name: 'DRAWFULANIMATE_FOOL_SAME_PLAYER',
      name: 'Малювач Анімач: Обдури мене тричі',
      description: 'Обдуріть одного й того ж гравця тричі за гру',
      internal_key: 256,
    });
    expect(colors.name).toBe('Малювач Анімач: Очисник палітри');
    expect(colors.description).toBe(schema.groups[0].achievements[1].description);
    expect(untouched).toBe(schema.groups[0].achievements[2]);
    expect(out.groups[0]).not.toBe(schema.groups[0]);
  });

  it('translates the copies by_status keeps of the same records', () => {
    const out = translateQueryData(copy(fixture.byStatus), JACKBOX, lookup);
    expect(names(out)).toEqual([
      'Малювач Анімач: Очисник палітри',
      'Малювач Анімач: Обдури мене тричі',
      fixture.byStatus.locked[1].name,
    ]);
  });

  it('returns the same object when nothing matches', () => {
    const schema = copy(fixture.schema);
    expect(translateQueryData(schema, 999, lookup)).toBe(schema);
  });
});

describe('hookAchievementQueries', () => {
  it('writes the translation back with the query timestamp, once', () => {
    const { client, flush } = setup();
    const query = client.fetched(schemaKey, copy(fixture.schema), 1000);
    expect(client.writes).toEqual([]);

    flush();
    flush();
    expect(client.writes).toEqual([{ key: schemaKey, updatedAt: 1000 }]);
    expect(query.state.dataUpdatedAt).toBe(1000);
    expect(names(query.state.data)[0]).toBe('Малювач Анімач: Обдури мене тричі');
  });

  it('leaves other apps and unrelated queries alone', () => {
    const { client, flush } = setup();
    client.fetched(['achievements', 10, 'schema'], copy(fixture.schema), 1);
    client.fetched(
      ['StoreItem', JACKBOX],
      { name: 'x', api_name: 'DRAWFULANIMATE_FOOL_SAME_PLAYER' },
      1
    );
    flush();
    expect(client.writes).toEqual([]);
  });

  it('translates what Steam loaded before the hook on refresh', () => {
    const client = new FakeQueryClient();
    client.fetched(byStatusKey, copy(fixture.byStatus), 5);
    const queries = hookAchievementQueries(client, has, lookup, () => undefined);
    queries.refresh();
    expect(client.writes).toEqual([{ key: byStatusKey, updatedAt: 5 }]);
  });

  it('reverts its own copies but not data Steam refetched since', () => {
    const { client, queries, flush } = setup();
    const schema = client.fetched(schemaKey, copy(fixture.schema), 1);
    const byStatus = client.fetched(byStatusKey, copy(fixture.byStatus), 1);
    flush();
    const refetched = copy(fixture.byStatus);
    client.fetched(byStatusKey, refetched, 2);

    queries.revert(new Set([String(JACKBOX)]));
    expect(schema.state.data).toEqual(fixture.schema);
    expect(schema.state.dataUpdatedAt).toBe(1);
    expect(byStatus.state.data).toBe(refetched);
  });

  it('forgets removed queries and stops listening on dispose', () => {
    const { client, queries, flush } = setup();
    const query = client.fetched(schemaKey, copy(fixture.schema), 1);
    flush();
    client.remove(schemaKey);
    const writes = client.writes.length;
    queries.dispose();
    expect(client.writes).toHaveLength(writes);
    expect(names(query.state.data)[0]).toBe('Малювач Анімач: Обдури мене тричі');

    const listener = vi.fn();
    client.listeners.add(listener);
    client.fetched(schemaKey, copy(fixture.schema), 2);
    flush();
    expect(client.listeners.size).toBe(1);
    expect(client.writes).toHaveLength(writes);
  });
});
