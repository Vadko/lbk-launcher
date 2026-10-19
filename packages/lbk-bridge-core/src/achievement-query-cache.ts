import { G } from '@mobily/ts-belt';
import type { AchLookup, AchText } from './achievement-text';
import { createTextMemory } from './achievement-text-memory';
import { isFn } from './steam-globals';

interface Query {
  queryKey: unknown;
  state: { data: unknown };
  setState(state: { data: unknown }): void;
}

export interface QueryClient {
  getQueryCache(): {
    getAll(): unknown[];
    subscribe(listener: (event: unknown) => void): () => void;
  };
}

type Rec = Record<string, unknown>;

export interface AchievementQueries {
  sync(appids: Set<string> | null): void;
  seen(): boolean;
  dispose(): void;
}

export const QUERY_TEXT_FIELDS: readonly (readonly [string, keyof AchText])[] = [
  ['name', 'name'],
  ['description', 'desc'],
];

export const isQueryClient = (v: unknown): v is QueryClient =>
  G.isObject(v) && isFn(v.getQueryCache) && isFn(v.setQueryData) && isFn(v.getQueryData);

const isQuery = (v: unknown): v is Query =>
  G.isObject(v) && 'queryKey' in v && G.isObject(v.state) && isFn(v.setState);

const isPlainObject = (v: unknown): v is Rec => {
  if (!G.isObject(v)) {
    return false;
  }
  const proto: unknown = Object.getPrototypeOf(v);
  return proto === Object.prototype || proto === null;
};

// The grouped achievements UI keys all of an app's data as ['achievements', appid, ...].
export function achievementQueryAppId(key: unknown): unknown {
  return G.isArray(key) && key[0] === 'achievements' ? key[1] : undefined;
}

// Copy-on-write over every { api_name, ... } record; untouched branches stay shared.
export function mapRecords(data: unknown, fn: (rec: Rec) => Rec, depth = 0): unknown {
  if (depth > 6) {
    return data;
  }
  if (G.isArray(data)) {
    let out: unknown[] | null = null;
    data.forEach((item, i) => {
      const next = mapRecords(item, fn, depth + 1);
      if (next !== item) {
        out ??= data.slice();
        out[i] = next;
      }
    });
    return out ?? data;
  }
  if (!isPlainObject(data)) {
    return data;
  }
  if (G.isString(data.api_name)) {
    return fn(data);
  }
  let out: Rec | null = null;
  for (const k of Object.keys(data)) {
    const next = mapRecords(data[k], fn, depth + 1);
    if (next !== data[k]) {
      out ??= { ...data };
      out[k] = next;
    }
  }
  return out ?? data;
}

// Translates where React Query writes: Query.setData (fetch, setQueryData), Query.setState and QueryCache.build (hydration); sync() goes through setState and keeps Steam's timestamps, invalidation and errors.
export function hookAchievementQueries(
  client: QueryClient,
  has: (appid: unknown) => boolean,
  lookup: AchLookup,
  schedule: (fn: () => void) => void = queueMicrotask
): AchievementQueries {
  const cache = client.getQueryCache();
  const memory = createTextMemory();
  type Undo = (() => void) | null;
  const restores = new Map<Query, [Undo, Undo]>();
  let writing = false;
  let seen = false;
  let disposed = false;

  const safely = (fn: () => void): void => {
    try {
      fn();
    } catch (e) {
      console.warn('[LBK] achievements query', e);
    }
  };
  const undo = (fns: readonly Undo[]): void => fns.forEach((fn) => fn && safely(fn));
  const present = (appid: unknown, data: unknown, translate: boolean): unknown =>
    mapRecords(data, (rec) => {
      const t = translate ? lookup(appid, rec.api_name) : undefined;
      let out = rec;
      for (const [key, field] of QUERY_TEXT_FIELDS) {
        const current = rec[key];
        if (!G.isString(current)) {
          continue;
        }
        const text = memory.show(appid, rec.api_name, field, current, t?.[field]);
        if (text !== current) {
          out = out === rec ? { ...rec } : out;
          out[key] = text;
        }
      }
      return out;
    });
  const presentState = (appid: unknown, state: unknown): unknown => {
    if (!G.isObject(state) || !has(appid)) {
      return state;
    }
    const data = present(appid, state.data, true);
    return data === state.data ? state : { ...state, data };
  };

  // An own wrapper that rewrites the arguments; its restore leaves a wrapper stacked on top in place.
  const wrap = (
    target: object,
    name: string,
    rewrite: (args: unknown[]) => void
  ): Undo => {
    const orig: unknown = Reflect.get(target, name);
    if (!isFn(orig)) {
      return null;
    }
    const hadOwn = Object.hasOwn(target, name);
    const wrapper = function (this: unknown, ...args: unknown[]) {
      safely(() => {
        if (!disposed) {
          rewrite(args);
        }
      });
      return orig.apply(this, args);
    };
    Reflect.set(target, name, wrapper);
    if (Reflect.get(target, name) !== wrapper) {
      return null;
    }
    return () => {
      if (Reflect.get(target, name) !== wrapper) {
        return;
      }
      if (hadOwn) {
        Reflect.set(target, name, orig);
      } else {
        Reflect.deleteProperty(target, name);
      }
    };
  };

  const update = (q: Query, revert: boolean): void => {
    const appid = achievementQueryAppId(q.queryKey);
    const next = present(appid, q.state.data, !revert && has(appid));
    if (next === q.state.data) {
      return;
    }
    writing = true;
    try {
      q.setState({ data: next });
    } finally {
      writing = false;
    }
  };
  const intercept = (q: Query, appid: unknown): void => {
    if (restores.has(q)) {
      return;
    }
    restores.set(q, [
      wrap(q, 'setData', (args) => {
        if (has(appid)) {
          args[0] = present(appid, args[0], true);
        }
      }),
      wrap(q, 'setState', (args) => {
        args[0] = presentState(appid, args[0]);
      }),
    ]);
  };
  const release = (q: Query): void => {
    undo(restores.get(q) ?? []);
    restores.delete(q);
  };
  const eachQuery = (fn: (q: Query, appid: unknown) => void): void => {
    for (const q of cache.getAll()) {
      if (!isQuery(q)) {
        continue;
      }
      const appid = achievementQueryAppId(q.queryKey);
      if (appid !== undefined) {
        seen = true;
        safely(() => fn(q, appid));
      }
    }
  };
  const updateAll = (appids: Set<string> | null, revert: boolean): void =>
    eachQuery((q, appid) => {
      if (!appids || appids.has(String(appid))) {
        update(q, revert);
      }
    });

  // Hydration builds a new query from its dehydrated state, which then never passes setData or setState.
  const unbuild = wrap(cache, 'build', (args) => {
    const options = args[1];
    const appid = G.isObject(options)
      ? achievementQueryAppId(options.queryKey)
      : undefined;
    if (appid !== undefined) {
      args[2] = presentState(appid, args[2]);
    }
  });
  eachQuery(intercept);
  const unsubscribe = cache.subscribe((event) => {
    if (!G.isObject(event) || !isQuery(event.query)) {
      return;
    }
    const q = event.query;
    const appid = achievementQueryAppId(q.queryKey);
    if (appid === undefined) {
      return;
    }
    if (event.type === 'removed') {
      release(q);
      return;
    }
    // Only on 'added': a removed query still reports observerRemoved and late updates.
    if (event.type === 'added') {
      safely(() => intercept(q, appid));
    }
    if (writing) {
      return;
    }
    seen = true;
    const action = G.isObject(event.action) ? event.action.type : undefined;
    // A success comes from setData, which the wrapper already translated.
    const delivered =
      event.type === 'added' ||
      (event.type === 'updated' &&
        (action === 'setState' || (action === 'success' && !restores.get(q)?.[0])));
    if (delivered && has(appid)) {
      // Outside the dispatch that delivered the data; React Query notifies observers on a later task.
      schedule(() => safely(() => update(q, false)));
    }
  });

  return {
    sync: (appids) => updateAll(appids, false),
    seen: () => seen,
    dispose() {
      disposed = true;
      unsubscribe();
      undo([unbuild]);
      restores.forEach(undo);
      restores.clear();
      updateAll(null, true);
    },
  };
}
