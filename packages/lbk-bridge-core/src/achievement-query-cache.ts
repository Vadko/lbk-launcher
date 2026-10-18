import type { AchText } from './achievement-text';
import { type AnyFn, isFn, isRecord } from './steam-globals';

type Lookup = (appid: unknown, id: unknown) => AchText | undefined;

interface Query {
  queryKey: unknown;
  state: { data: unknown; dataUpdatedAt: number };
}

export interface QueryClient {
  getQueryCache(): { getAll(): Query[]; subscribe(listener: AnyFn): () => void };
  setQueryData(key: unknown, data: unknown, options: { updatedAt: number }): unknown;
}

export interface AchievementQueries {
  refresh(): void;
  revert(appids: Set<string> | null): void;
  dispose(): void;
}

export const isQueryClient = (v: unknown): v is QueryClient =>
  isRecord(v) && isFn(v.getQueryCache) && isFn(v.setQueryData);

const isQuery = (v: unknown): v is Query =>
  isRecord(v) && 'queryKey' in v && isRecord(v.state);

// The grouped achievements UI keys all of an app's data as ['achievements', appid, ...].
export function achievementQueryAppId(key: unknown): unknown {
  return Array.isArray(key) && key[0] === 'achievements' ? key[1] : undefined;
}

// A translated copy that shares every untouched branch, or `data` itself when nothing changed.
export function translateQueryData(
  data: unknown,
  appid: unknown,
  lookup: Lookup,
  depth = 0
): unknown {
  if (!isRecord(data) || depth > 6) {
    return data;
  }
  if (Array.isArray(data)) {
    let out: unknown[] | null = null;
    data.forEach((item, i) => {
      const next = translateQueryData(item, appid, lookup, depth + 1);
      if (next !== item) {
        out ??= data.slice();
        out[i] = next;
      }
    });
    return out ?? data;
  }
  if (typeof data.api_name === 'string') {
    const t = lookup(appid, data.api_name);
    const name = t?.name ?? data.name;
    const description = t?.desc ?? data.description;
    return name === data.name && description === data.description
      ? data
      : { ...data, name, description };
  }
  let out: Record<string, unknown> | null = null;
  for (const k of Object.keys(data)) {
    const next = translateQueryData(data[k], appid, lookup, depth + 1);
    if (next !== data[k]) {
      out ??= { ...data };
      out[k] = next;
    }
  }
  return out ?? data;
}

// Writes translated copies back with the query's own dataUpdatedAt: the derived queries key on it, and nothing refetches.
export function hookAchievementQueries(
  client: QueryClient,
  has: (appid: unknown) => boolean,
  lookup: Lookup,
  schedule: (fn: () => void) => void = queueMicrotask
): AchievementQueries {
  const originals = new Map<Query, unknown>();
  const translated = new WeakSet<object>();
  let writing = false;

  const write = (q: Query, data: unknown): void => {
    writing = true;
    try {
      client.setQueryData(q.queryKey, data, { updatedAt: q.state.dataUpdatedAt });
    } finally {
      writing = false;
    }
  };
  const translate = (q: Query): void => {
    const appid = achievementQueryAppId(q.queryKey);
    const data = q.state.data;
    if (appid === undefined || !has(appid) || !isRecord(data) || translated.has(data)) {
      return;
    }
    const next = translateQueryData(data, appid, lookup);
    if (next === data) {
      return;
    }
    originals.set(q, data);
    write(q, next);
    if (isRecord(q.state.data)) {
      translated.add(q.state.data);
    }
  };
  const safeTranslate = (q: Query): void => {
    try {
      translate(q);
    } catch (e) {
      console.warn('[LBK] achievements query', e);
    }
  };

  const unsubscribe = client.getQueryCache().subscribe((event: unknown) => {
    if (writing || !isRecord(event) || !isQuery(event.query)) {
      return;
    }
    const q = event.query;
    if (event.type === 'removed') {
      originals.delete(q);
    } else if (
      event.type === 'added' ||
      (event.type === 'updated' &&
        isRecord(event.action) &&
        event.action.type === 'success')
    ) {
      // Outside the dispatch that delivered the data; React Query notifies observers on a later task.
      schedule(() => safeTranslate(q));
    }
  });

  const revert = (appids: Set<string> | null): void => {
    for (const [q, original] of originals) {
      if (appids && !appids.has(String(achievementQueryAppId(q.queryKey)))) {
        continue;
      }
      originals.delete(q);
      // A refetch since then already replaced our copy with Steam's own data.
      if (isRecord(q.state.data) && translated.has(q.state.data)) {
        write(q, original);
      }
    }
  };

  return {
    refresh() {
      for (const q of client.getQueryCache().getAll()) {
        safeTranslate(q);
      }
    },
    revert,
    dispose() {
      unsubscribe();
      revert(null);
    },
  };
}
