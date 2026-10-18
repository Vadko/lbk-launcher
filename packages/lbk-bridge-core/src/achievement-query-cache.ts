import { type AchLookup, type AchText, createTextMemory } from './achievement-text';
import { isFn, isRecord } from './steam-globals';

interface Query {
  queryKey: unknown;
  state: { data: unknown };
  setState(state: { data: unknown }): void;
}

interface QueryClient {
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

const FIELDS: readonly (readonly [string, keyof AchText])[] = [
  ['name', 'name'],
  ['description', 'desc'],
];

export const isQueryClient = (v: unknown): v is QueryClient =>
  isRecord(v) && isFn(v.getQueryCache) && isFn(v.setQueryData) && isFn(v.getQueryData);

const isQuery = (v: unknown): v is Query =>
  isRecord(v) && 'queryKey' in v && isRecord(v.state) && isFn(v.setState);

const isPlainObject = (v: unknown): v is Rec => {
  if (!isRecord(v)) {
    return false;
  }
  const proto: unknown = Object.getPrototypeOf(v);
  return proto === Object.prototype || proto === null;
};

// The grouped achievements UI keys all of an app's data as ['achievements', appid, ...].
export function achievementQueryAppId(key: unknown): unknown {
  return Array.isArray(key) && key[0] === 'achievements' ? key[1] : undefined;
}

// Copy-on-write over every { api_name, ... } record; untouched branches stay shared.
function mapRecords(data: unknown, fn: (rec: Rec) => Rec, depth = 0): unknown {
  if (depth > 6) {
    return data;
  }
  if (Array.isArray(data)) {
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
  if (typeof data.api_name === 'string') {
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

// Query.setState swaps only the data: timestamps, invalidation and errors stay Steam's, and nothing refetches.
export function hookAchievementQueries(
  client: QueryClient,
  has: (appid: unknown) => boolean,
  lookup: AchLookup,
  schedule: (fn: () => void) => void = queueMicrotask
): AchievementQueries {
  const memory = createTextMemory();
  let writing = false;
  let seen = false;

  const update = (q: Query, revert: boolean): void => {
    const appid = achievementQueryAppId(q.queryKey);
    const translate = !revert && has(appid);
    const next = mapRecords(q.state.data, (rec) => {
      const t = translate ? lookup(appid, rec.api_name) : undefined;
      let out = rec;
      for (const [key, field] of FIELDS) {
        const current = rec[key];
        if (typeof current !== 'string') {
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
  const safeUpdate = (q: Query, revert: boolean): void => {
    try {
      update(q, revert);
    } catch (e) {
      console.warn('[LBK] achievements query', e);
    }
  };
  const updateAll = (appids: Set<string> | null, revert: boolean): void => {
    for (const q of client.getQueryCache().getAll()) {
      if (!isQuery(q)) {
        continue;
      }
      const appid = achievementQueryAppId(q.queryKey);
      if (appid === undefined) {
        continue;
      }
      seen = true;
      if (!appids || appids.has(String(appid))) {
        safeUpdate(q, revert);
      }
    }
  };

  const unsubscribe = client.getQueryCache().subscribe((event) => {
    if (writing || !isRecord(event) || !isQuery(event.query)) {
      return;
    }
    const q = event.query;
    const appid = achievementQueryAppId(q.queryKey);
    if (appid === undefined) {
      return;
    }
    seen = true;
    const action = isRecord(event.action) ? event.action.type : undefined;
    const delivered =
      event.type === 'added' ||
      (event.type === 'updated' && (action === 'success' || action === 'setState'));
    if (delivered && has(appid)) {
      // Outside the dispatch that delivered the data; React Query notifies observers on a later task.
      schedule(() => safeUpdate(q, false));
    }
  });

  return {
    sync: (appids) => updateAll(appids, false),
    seen: () => seen,
    dispose() {
      unsubscribe();
      updateAll(null, true);
    },
  };
}
