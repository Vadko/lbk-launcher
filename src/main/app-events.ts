import { EventEmitter } from 'node:events';

interface AppEventMap {
  'install-record-removed': [gameId: string];
  'steam-started': [];
  'steam-exited': [];
  'plugin-connection': [connected: boolean];
  'bridge-ready': [];
  'millennium-phase': [phase: 'install-files' | 'installed'];
  error: [error: unknown];
}

// emit() runs listeners synchronously and a throw skips the rest, so listeners must not throw.
export const appEvents = new EventEmitter<AppEventMap>({ captureRejections: true });

appEvents.on('error', (error) => {
  console.warn('[Main] App event listener failed:', error);
});
