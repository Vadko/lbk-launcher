import { isDeepStrictEqual } from 'node:util';
import { D } from '@mobily/ts-belt';
import type { ResourceKey, ResourceMap, ResourceUpdate } from '@/shared/resources';

// A MessagePortMain fits it; its own postMessage takes any
interface ResourceSink {
  postMessage: (update: ResourceUpdate) => void;
  close: () => void;
}

// Values outlive the page, so a reload starts from them
const hub: {
  values: Partial<ResourceMap>;
  failed: Set<ResourceKey>;
  sink: ResourceSink | null;
} = { values: {}, failed: new Set(), sink: null };

// A port that cannot take a value must not throw into a read, an owner or the counters feed
function send(values: Partial<ResourceMap>): void {
  try {
    hub.sink?.postMessage({ values, failed: new Set(hub.failed) });
  } catch (error) {
    console.error('[Resources] Failed to publish:', error);
  }
}

function hold<K extends ResourceKey>(key: K, value: ResourceMap[K]): void {
  hub.values[key] = value;
  send(D.selectKeys(hub.values, [key]));
}

// An equal value sends nothing, unless it clears a failure
export function publishResource<K extends ResourceKey>(
  key: K,
  value: ResourceMap[K]
): void {
  const cleared = hub.failed.delete(key);
  if (cleared || !isDeepStrictEqual(hub.values[key], value)) {
    hold(key, value);
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
  if (next !== value) {
    hold(key, next);
  }
}

// The page keeps the value it has
export function failResource(key: ResourceKey): void {
  if (!hub.failed.has(key)) {
    hub.failed.add(key);
    send({});
  }
}

// A new page starts from everything held and replaces the old one; the returned function ends its session
export function openResourceSession(sink: ResourceSink): () => void {
  hub.sink?.close();
  hub.sink = sink;
  if (D.isNotEmpty(hub.values) || hub.failed.size > 0) {
    send(hub.values);
  }
  return () => {
    if (hub.sink === sink) {
      hub.sink = null;
    }
  };
}
