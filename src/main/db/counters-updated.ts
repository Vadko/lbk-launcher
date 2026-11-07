import { appEvents } from '@/main/app-events';
import { sendToRenderer } from '@/main/window';
import type { Game } from '@/shared/types';

// The game list and the resources holding these games patch the rows in place
export function notifyCountersUpdated(games: Game[]): void {
  if (games.length === 0) {
    return;
  }
  sendToRenderer('game-counters-updated', games);
  appEvents.emit('counters-changed', games);
}
