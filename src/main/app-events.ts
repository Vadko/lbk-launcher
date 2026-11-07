import { EventEmitter } from 'node:events';
import type { MillenniumApplyReport } from '@/main/millennium-install/apply';
import type { SyncStatus } from '@/main/sync-status';
import type { ResourceKey } from '@/shared/resources';
import type { Game } from '@/shared/types';

interface AppEventMap {
  'install-record-removed': [gameId: string];
  'steam-started': [];
  'steam-exited': [];
  'plugin-connection': [connected: boolean];
  'bridge-ready': [];
  'millennium-phase': [phase: 'install-files' | 'installed'];
  'millennium-applied': [report: MillenniumApplyReport];
  'sync-status': [status: SyncStatus];
  // Sources of the resources main pushes to the renderer
  'catalog-changed': [];
  'library-changed': [];
  'installs-changed': [];
  'counters-changed': [games: readonly Game[]];
  'store-discounts-changed': [];
  'weekly-picks-changed': [];
  'likes-changed': [];
  'resource-wanted': [key: ResourceKey];
  error: [error: unknown];
}

export type AppEventName = keyof AppEventMap;

// emit() runs listeners synchronously and a sync throw skips the rest; a listener that can fail is async, so captureRejections logs it.
export const appEvents = new EventEmitter<AppEventMap>({ captureRejections: true });

// Every resource listens for resource-wanted and its own sources, past the default leak warning at 10
appEvents.setMaxListeners(50);

appEvents.on('error', (error) => {
  console.warn('[Main] App event listener failed:', error);
});
