import { isDeepStrictEqual } from 'node:util';
import { D, G } from '@mobily/ts-belt';
import { appEvents } from '@/main/app-events';
import {
  isResourceKey,
  type ResourceKey,
  type ResourceMap,
  type ResourceUpdate,
} from '@/shared/resources';

interface ResourceSink {
  post: (update: ResourceUpdate) => void;
  close: () => void;
}

interface ResourceSession {
  receive: (data: unknown) => void;
  end: () => void;
}

// Values outlive the page, so a reload starts from them; wanted is what the current page subscribed to
const hub: {
  values: Partial<ResourceMap>;
  failed: Set<ResourceKey>;
  wanted: Set<ResourceKey>;
  sink: ResourceSink | null;
} = { values: {}, failed: new Set(), wanted: new Set(), sink: null };

function pick<K extends ResourceKey>(into: Partial<ResourceMap>, key: K): void {
  if (key in hub.values) {
    into[key] = hub.values[key];
  }
}

export function getResource<K extends ResourceKey>(key: K): ResourceMap[K] | undefined {
  return hub.values[key];
}

export const isResourceWanted = (key: ResourceKey): boolean => hub.wanted.has(key);

export function publishResource<K extends ResourceKey>(
  key: K,
  value: ResourceMap[K]
): void {
  const wasFailed = hub.failed.delete(key);
  if (!wasFailed && isDeepStrictEqual(hub.values[key], value)) {
    return;
  }
  hub.values[key] = value;
  if (hub.wanted.has(key)) {
    const values: Partial<ResourceMap> = {};
    pick(values, key);
    hub.sink?.post({ values, failed: [] });
  }
}

// A patch is not a read, so a failed key stays failed
export function patchResource<K extends ResourceKey>(
  key: K,
  patch: (value: ResourceMap[K]) => ResourceMap[K]
): void {
  const value = hub.values[key];
  if (value === undefined) {
    return;
  }
  const next = patch(value);
  if (next === value) {
    return;
  }
  hub.values[key] = next;
  if (hub.wanted.has(key)) {
    const values: Partial<ResourceMap> = {};
    pick(values, key);
    hub.sink?.post({ values, failed: hub.failed.has(key) ? [key] : [] });
  }
}

export function failResource(key: ResourceKey): void {
  if (hub.failed.has(key)) {
    return;
  }
  hub.failed.add(key);
  if (hub.wanted.has(key)) {
    hub.sink?.post({ values: {}, failed: [key] });
  }
}

function subscribe(keys: ResourceKey[]): void {
  const fresh = keys.filter((key) => !hub.wanted.has(key));
  if (fresh.length === 0) {
    return;
  }
  const values: Partial<ResourceMap> = {};
  for (const key of fresh) {
    hub.wanted.add(key);
    pick(values, key);
  }
  const failed = fresh.filter((key) => hub.failed.has(key));
  if (failed.length > 0 || D.isNotEmpty(values)) {
    hub.sink?.post({ values, failed });
  }
  for (const key of fresh) {
    appEvents.emit('resource-wanted', key);
  }
}

// A new page opens a new session; what the old one wanted no longer has a listener
export function openResourceSession(sink: ResourceSink): ResourceSession {
  const previous = hub.sink;
  hub.sink = sink;
  hub.wanted.clear();
  previous?.close();
  const current = () => hub.sink === sink;
  return {
    receive: (data) => {
      const keys: unknown = G.isObject(data) ? data.subscribe : undefined;
      if (current() && G.isArray(keys)) {
        subscribe(keys.filter(isResourceKey));
      }
    },
    end: () => {
      if (current()) {
        hub.sink = null;
        hub.wanted.clear();
      }
    },
  };
}
