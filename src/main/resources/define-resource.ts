import { F } from '@mobily/ts-belt';
import pLimit from 'p-limit';
import pTimeout from 'p-timeout';
import { type AppEventName, appEvents } from '@/main/app-events';
import { isCatalogReady } from '@/main/sync-status';
import type { ResourceKey, ResourceMap } from '@/shared/resources';
import {
  failResource,
  getResource,
  isResourceWanted,
  publishResource,
} from './resource-hub';

// A burst of events (a bulk edit broadcasts every game) gets one read once it goes quiet
const EVENT_DEBOUNCE_MS = 300;
// A read that never settles would otherwise hold the queue for the rest of the session
const READ_TIMEOUT_MS = 30_000;

export type ResourceTrigger = (fire: () => void) => unknown;

export interface ResourceDefinition<K extends ResourceKey> {
  read: () => ResourceMap[K] | Promise<ResourceMap[K]>;
  on: ReadonlyArray<AppEventName | ResourceTrigger>;
  // Reads the local catalog, which the first sync is still writing
  afterCatalogSync?: boolean;
}

// Reads only while the page wants the key; a change nobody watches leaves it stale until a page subscribes
export function defineResource<K extends ResourceKey>(
  key: K,
  { read, on, afterCatalogSync = false }: ResourceDefinition<K>
): void {
  const state = { dirty: false, loaded: false, queued: false };
  const queue = pLimit(1);
  const canRead = () => isResourceWanted(key) && (!afterCatalogSync || isCatalogReady());
  // A value its owner published before the page asked needs no read of its own
  const isStale = () => state.dirty || (!state.loaded && getResource(key) === undefined);

  const readOnce = async (): Promise<void> => {
    state.queued = false;
    if (!isStale() || !canRead()) {
      return;
    }
    state.dirty = false;
    state.loaded = true;
    let value: ResourceMap[K];
    try {
      value = await pTimeout(Promise.resolve().then(read), {
        milliseconds: READ_TIMEOUT_MS,
      });
    } catch (error) {
      state.dirty = true;
      console.error(`[Resources] Failed to read ${key}:`, error);
      failResource(key);
      return;
    }
    // Outside the try: a throw while sending is not a failed read of this key
    publishResource(key, value);
  };

  // One read at a time and at most one waiting behind it
  const schedule = (): void => {
    if (state.queued) {
      return;
    }
    state.queued = true;
    queue(readOnce).catch((error: unknown) => {
      console.error(`[Resources] Failed to publish ${key}:`, error);
    });
  };
  const refresh = (): void => {
    if (isStale() && canRead()) {
      schedule();
    }
  };
  const refreshLater = F.debounce(refresh, EVENT_DEBOUNCE_MS);
  const fire = (): void => {
    state.dirty = true;
    refreshLater();
  };

  appEvents.on('resource-wanted', (wanted) => {
    if (wanted === key) {
      refresh();
    }
  });
  if (afterCatalogSync) {
    // The sync rewrote the catalog without per-game events, and the page waits on this read
    appEvents.on('sync-status', () => {
      state.dirty = true;
      refresh();
    });
  }
  for (const trigger of on) {
    if (typeof trigger === 'string') {
      appEvents.on(trigger, fire);
    } else {
      trigger(fire);
    }
  }
}
