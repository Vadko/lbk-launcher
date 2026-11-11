import { EventEmitter } from 'node:events';
import type { MillenniumApplyReport } from '@/main/millennium-install/apply';
import type { SyncStatus } from '@/main/sync-status';
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
  'language-changed': [];
  // Sources of the resources main pushes to the renderer
  'catalog-changed': [];
  'library-changed': [];
  'installs-changed': [];
  'counters-changed': [games: readonly Game[]];
  'store-discounts-changed': [];
  'weekly-picks-changed': [];
  'likes-changed': [];
  'workshop-installs-changed': [];
  'hide-ai-changed': [];
  'wine-prefixes-changed': [];
  error: [error: unknown];
}

export type AppEventName = keyof AppEventMap;

// emit() runs listeners synchronously and a sync throw skips the rest; a listener that can fail is async, so captureRejections logs it.
export const appEvents = new EventEmitter<AppEventMap>({ captureRejections: true });

// Seven resources follow catalog-changed and sync-status alike, close to the default leak warning at 10
appEvents.setMaxListeners(50);

appEvents.on('error', (error) => {
  console.warn('[Main] App event listener failed:', error);
});
