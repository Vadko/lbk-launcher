import { appEvents } from '@/main/app-events';
import { sendToRenderer } from '@/main/window';
import type { Game } from '@/shared/types';

// The game list patches these rows in place; resources that show counters read them again
export function notifyCountersUpdated(games: Game[]): void {
  if (games.length === 0) {
    return;
  }
  sendToRenderer('game-counters-updated', games);
  appEvents.emit('counters-changed');
}
