import { F } from '@mobily/ts-belt';
import pLimit from 'p-limit';
import pTimeout from 'p-timeout';
import { type AppEventName, appEvents } from '@/main/app-events';
import { isCatalogReady } from '@/main/sync-status';
import type { ResourceKey, ResourceMap } from '@/shared/resources';
import type { Game } from '@/shared/types';
import { failResource, patchResource, publishResource } from './resource-hub';

// A burst of events (a bulk edit broadcasts every game) gets one read once it goes quiet
const EVENT_DEBOUNCE_MS = 300;
// A player's toggle sends one alone, and the page shows its result, so its read starts at once
const UNBATCHED_EVENTS: ReadonlySet<AppEventName> = new Set(['hide-ai-changed']);
// A read that never settles is abandoned, not stopped, so the next one may start beside it
const READ_TIMEOUT_MS = 30_000;

export interface ResourceDefinition<K extends ResourceKey> {
  read: () => ResourceMap[K] | Promise<ResourceMap[K]>;
  on: readonly AppEventName[];
  // Reads the local catalog, which the first sync is still writing
  afterCatalogSync?: boolean;
  // Lays the counters feed's rows over the value held, for a list whose read costs more than a patch
  withCounters?: (value: ResourceMap[K], games: readonly Game[]) => ResourceMap[K];
}

// Nothing is read before the page first asks for the key; from then on it stays current, page or no page
export function defineResource<K extends ResourceKey>(
  key: K,
  { read, on, afterCatalogSync = false, withCounters }: ResourceDefinition<K>
): void {
  const reads = pLimit(1);
  const readAndPublish = async (): Promise<void> => {
    try {
      const value = await pTimeout(Promise.resolve().then(read), {
        milliseconds: READ_TIMEOUT_MS,
      });
      publishResource(key, value);
    } catch (error) {
      console.error(`[Resources] Failed to read ${key}:`, error);
      failResource(key);
    }
  };
  // One read runs and one waits behind it; a request while one waits is absorbed by it
  const refresh = (): void => {
    if (reads.pendingCount === 0 && (!afterCatalogSync || isCatalogReady())) {
      void reads(readAndPublish);
    }
  };
  const refreshSoon = F.debounce(refresh, EVENT_DEBOUNCE_MS);

  const start = F.once(() => {
    for (const event of on) {
      appEvents.on(event, UNBATCHED_EVENTS.has(event) ? refresh : refreshSoon);
    }
    if (afterCatalogSync) {
      // The sync rewrote the catalog without per-game events, and the page waits on this read
      appEvents.on('sync-status', refresh);
    }
    if (withCounters) {
      appEvents.on('counters-changed', (games) => {
        // A throw would skip the other listeners and land in the counters feed, so a full read stands in
        try {
          patchResource(key, (value) => withCounters(value, games));
        } catch (error) {
          console.error(`[Resources] Failed to patch ${key}:`, error);
          refresh();
        }
      });
    }
  });
  // A new page reads every key once more; an unchanged value sends nothing
  appEvents.on('resource-wanted', (wanted) => {
    if (wanted === key) {
      start();
      refresh();
    }
  });
}
