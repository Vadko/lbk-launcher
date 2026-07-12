import type { Game } from '@/shared/types.ts';
import { getMainWindow } from '../window';
import type { BroadcastMessage, BroadcastSubscription } from './supabase-realtime';

export function createGamesBroadcastSubscription(
  onUpdate: (game: Game) => void,
  onDelete: (gameId: string) => void
): BroadcastSubscription {
  const handle = (event: string) => (message: BroadcastMessage) => {
    const game = message.payload as Game;
    console.log(`[SupabaseRealtime] Game ${event}:`, game.name, `(${game.id})`);

    if (event === 'DELETE') {
      onDelete(game.id);
      return;
    }

    if (!game.approved) {
      if (event === 'UPDATE') {
        console.log('[SupabaseRealtime] Game unapproved, removing:', game.name);
        onDelete(game.id);
      } else {
        console.log('[SupabaseRealtime] New game not approved, skipping:', game.name);
      }
      return;
    }

    onUpdate(game);
    getMainWindow()?.webContents.send('game-updated', game);
  };

  return {
    topic: 'games-broadcast',
    handlers: [
      { event: 'INSERT', handler: handle('INSERT') },
      { event: 'UPDATE', handler: handle('UPDATE') },
      { event: 'DELETE', handler: handle('DELETE') },
    ],
  };
}
