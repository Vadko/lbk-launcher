import { EventEmitter } from 'node:events';
import type { MillenniumApplyReport } from '@/main/millennium-install/apply';

interface AppEventMap {
  'install-record-removed': [gameId: string];
  'steam-started': [];
  'steam-exited': [];
  'plugin-connection': [connected: boolean];
  'bridge-ready': [];
  'millennium-phase': [phase: 'install-files' | 'installed'];
  'millennium-applied': [report: MillenniumApplyReport];
  error: [error: unknown];
}

// emit() runs listeners synchronously and a sync throw skips the rest; a listener that can fail is async, so captureRejections logs it.
export const appEvents = new EventEmitter<AppEventMap>({ captureRejections: true });

appEvents.on('error', (error) => {
  console.warn('[Main] App event listener failed:', error);
});
