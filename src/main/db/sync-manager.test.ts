import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Game } from '@/shared/types';

const { send, repo } = vi.hoisted(() => ({
  send: vi.fn(),
  repo: { isGameVisible: vi.fn(), upsertGame: vi.fn(), getGameById: vi.fn() },
}));

vi.mock('@/main/window', () => ({
  getMainWindow: () => ({ webContents: { send } }),
  sendToRenderer: send,
}));
vi.mock('@/main/db/games-repository', () => ({
  GamesRepository: { getInstance: () => repo },
}));
vi.mock('@/main/db/database', () => ({ getDatabase: () => ({}) }));
vi.mock('@/main/db/db-queries', () => ({ upsertTagNames: vi.fn() }));
vi.mock('@/main/db/db-worker-client', () => ({ dbWorkerClient: {} }));
vi.mock('@/main/db/sync-metadata', () => ({
  getSyncMetadata: vi.fn(),
  setSyncMetadata: vi.fn(),
}));
vi.mock('@/main/installer/cache', () => ({ getLocallyInstalledGameIds: vi.fn() }));
vi.mock('@/main/utils/logger', () => ({ createTimer: vi.fn() }));

const { SyncManager } = await import('./sync-manager');

const game = { id: 'g1', name: 'Hidden', approved: true, hide: true, likes: 0 } as Game;
const stored = { ...game, likes: 5 };

beforeEach(() => {
  send.mockReset();
  repo.isGameVisible.mockReset();
  repo.upsertGame.mockReset();
  repo.getGameById.mockReturnValue(stored);
  vi.spyOn(console, 'log').mockImplementation(() => undefined);
});

describe('handleRealtimeUpdate', () => {
  it.each([
    ['a new or still hidden game', false, false, []],
    ['a game the user unlocked', true, true, [['game-updated', stored]]],
    ['a hidden game made visible', false, true, [['game-updated', stored]]],
    ['a visible game hidden', true, false, [['game-removed', 'g1']]],
  ])('%s', (_, before, after, events) => {
    repo.isGameVisible.mockReturnValueOnce(before).mockReturnValueOnce(after);

    new SyncManager().handleRealtimeUpdate(game);

    expect(repo.upsertGame).toHaveBeenCalledWith(game);
    expect(send.mock.calls).toEqual(events);
  });
});
