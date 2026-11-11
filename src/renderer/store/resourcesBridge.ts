import { D } from '@mobily/ts-belt';
import {
  RESOURCES_CHANNEL,
  type ResourceKey,
  type ResourceSubscribe,
  type ResourceUpdate,
} from '@/shared/resources';
import { useResourcesStore } from './useResourcesStore';

// Start: the home page and the game list; idle: the filters, ratings and Steam, whose reads list processes
const SUBSCRIBE_AT = {
  likedGameIds: 'start',
  storeDiscounts: 'start',
  homeInstalled: 'start',
  weeklyPicks: 'start',
  popularGames: 'start',
  newStarGames: 'start',
  facetRows: 'idle',
  catalogOptions: 'idle',
  libraries: 'idle',
  installedTranslationIds: 'idle',
  ratings: 'idle',
  steamBridgeStatus: 'idle',
  pluginHostState: 'idle',
  wineBottles: 'idle',
} as const satisfies Record<ResourceKey, 'start' | 'idle'>;

const keysAt = (when: 'start' | 'idle'): ResourceKey[] =>
  D.keys(SUBSCRIBE_AT).filter((key) => SUBSCRIBE_AT[key] === when);

// The port lands once per page; every subscribe waits for it
const port = Promise.withResolvers<MessagePort>();

function subscribe(keys: ResourceKey[]): void {
  void port.promise.then((p) =>
    p.postMessage({ subscribe: keys } satisfies ResourceSubscribe)
  );
}

export function initResources(): void {
  window.addEventListener('message', (event) => {
    const [received] = event.ports;
    if (event.source !== window || event.data !== RESOURCES_CHANNEL || !received) {
      return;
    }
    received.onmessage = ({ data }: MessageEvent<ResourceUpdate>) =>
      useResourcesStore.getState().apply(data);
    port.resolve(received);
  });
  window.electronAPI.connectResources();
  subscribe(keysAt('start'));
  requestIdleCallback(() => subscribe(keysAt('idle')), { timeout: 2000 });
}

// Main reads a key once more on every subscribe, so this is how a view asks for a fresh value
export function refreshResource(key: ResourceKey): void {
  subscribe([key]);
}
