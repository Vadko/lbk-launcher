import { D } from '@mobily/ts-belt';
import {
  RESOURCES_PORT_CHANNEL,
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
  facetRows: 'idle',
  catalogOptions: 'idle',
  libraries: 'idle',
  installedTranslationIds: 'idle',
  ratings: 'idle',
  steamBridgeStatus: 'idle',
  pluginHostState: 'idle',
} as const satisfies Record<ResourceKey, 'start' | 'idle'>;

const keysAt = (when: 'start' | 'idle'): ResourceKey[] =>
  D.keys(SUBSCRIBE_AT).filter((key) => SUBSCRIBE_AT[key] === when);

export function initResources(): void {
  window.addEventListener('message', (event) => {
    const [port] = event.ports;
    if (event.source !== window || event.data !== RESOURCES_PORT_CHANNEL || !port) {
      return;
    }
    const subscribe = (keys: ResourceKey[]) =>
      port.postMessage({ subscribe: keys } satisfies ResourceSubscribe);
    port.onmessage = ({ data }: MessageEvent<ResourceUpdate>) =>
      useResourcesStore.getState().apply(data);
    subscribe(keysAt('start'));
    requestIdleCallback(() => subscribe(keysAt('idle')), { timeout: 2000 });
  });
  window.electronAPI.connectResources();
}
