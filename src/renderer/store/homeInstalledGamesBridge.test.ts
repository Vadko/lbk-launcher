import { describe, expect, it, vi } from 'vitest';
import type { Game } from '../../shared/types';
import { fakeElectronApi } from './bridgeApi.fixture';

vi.mock('./useStore', async () => {
  const { create } = await import('zustand');
  return { useStore: create(() => ({ syncStatus: 'ready' })) };
});
vi.mock('./useSettingsStore', async () => {
  const { create } = await import('zustand');
  return { useSettingsStore: create(() => ({ hideAiTranslations: false })) };
});

const game = (id: string, downloads: number) => ({ id, downloads }) as Game;

const getAllInstalledGamePaths = vi.fn(() => Promise.resolve(['common/A', 'common/B']));
const findGamesByInstallPaths = vi.fn(() =>
  Promise.resolve({ games: [game('a', 1), game('b', 2)], total: 2 })
);
const { api, emit } = fakeElectronApi({
  getAllInstalledGamePaths,
  findGamesByInstallPaths,
});
vi.stubGlobal('window', { electronAPI: api, addEventListener: vi.fn() });
vi.useFakeTimers();

const { useHomeInstalledGamesStore } = await import('./useHomeInstalledGamesStore');
const { initHomeInstalledGames } = await import('./homeInstalledGamesBridge');

describe('initHomeInstalledGames', () => {
  it('patches pushed counters into the installed games without a new scan', async () => {
    initHomeInstalledGames();
    await vi.runAllTimersAsync();
    getAllInstalledGamePaths.mockClear();

    emit('onGameCountersUpdated', [game('a', 9)]);
    await vi.advanceTimersByTimeAsync(300);

    expect(useHomeInstalledGamesStore.getState()).toMatchObject({
      games: [game('a', 9), game('b', 2)],
      installedPathsCount: 2,
    });
    expect(getAllInstalledGamePaths).not.toHaveBeenCalled();
  });
});
