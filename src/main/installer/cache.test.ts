import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { saveAchievementStrings } from '@/main/achievements/strings-store';
import { detectGamePaths } from '@/main/game-detector';
import type { Game } from '@/shared/types';
import { checkInstallation } from './cache';

const state = vi.hoisted(() => ({ root: '' }));

vi.mock('electron', () => ({
  app: { getPath: () => path.join(state.root, 'userData') },
}));
vi.mock('@/main/game-detector', () => ({
  detectGamePaths: vi.fn(),
  getFirstAvailableGamePath: vi.fn(),
}));
vi.mock('@/main/db/games-repository', () => ({ GamesRepository: {} }));
vi.mock('@/main/utils/store-storage', () => ({ getWorkshopInstalledGameIds: () => [] }));

beforeEach(() => {
  state.root = fs.mkdtempSync(path.join(os.tmpdir(), 'lbk-cache-'));
  vi.spyOn(console, 'log').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
  fs.rmSync(state.root, { recursive: true, force: true });
});

describe('a record re-cached from the game folder', () => {
  const gamePath = () => path.join(state.root, 'Game');
  const gameCopy = () => path.join(gamePath(), '.lbk-translation.json');
  const cacheCopy = () =>
    path.join(state.root, 'userData', 'installation-cache', 'game-a.json');
  const game = { id: 'game-a', install_paths: null, steam_app_id: 900 } as Game;
  const record = {
    gameId: 'game-a',
    version: '1.0.0',
    installedAt: '2026-01-01T00:00:00.000Z',
    gamePath: '',
    installedPlatform: 'steam',
    components: {
      text: { installed: true, files: ['a.txt'] },
      achievements: { installed: true, files: [], archiveHash: 'h', appIds: [900] },
    },
  };
  const installed = (file: string) =>
    JSON.parse(fs.readFileSync(file, 'utf8')).components.achievements.installed;

  beforeEach(() => {
    fs.mkdirSync(gamePath(), { recursive: true });
    fs.writeFileSync(gameCopy(), JSON.stringify({ ...record, gamePath: gamePath() }));
    vi.mocked(detectGamePaths).mockReturnValue([
      { platform: 'steam', path: gamePath(), exists: true },
    ]);
  });

  it.each<[string, boolean, boolean]>([
    ['works again with the strings it kept', true, true],
    ['offers the achievements again once their strings are gone', false, false],
  ])('%s', async (_case, kept, stillInstalled) => {
    if (kept) {
      saveAchievementStrings(
        [{ appId: 900, strings: { ACH: { name: 'Card' } } }],
        { gameId: 'game-a', gamePath: gamePath() },
        'h'
      );
    }

    const info = await checkInstallation(game);

    expect(info?.components?.achievements?.installed).toBe(stillInstalled);
    expect(info?.components?.text).toEqual({ installed: true, files: ['a.txt'] });
    expect(installed(gameCopy())).toBe(stillInstalled);
    expect(installed(cacheCopy())).toBe(stillInstalled);
  });

  it('leaves a record that is already cached to the uninstall in flight', async () => {
    fs.mkdirSync(path.dirname(cacheCopy()), { recursive: true });
    fs.copyFileSync(gameCopy(), cacheCopy());

    expect((await checkInstallation(game))?.components?.achievements?.installed).toBe(
      true
    );
    expect(installed(gameCopy())).toBe(true);
  });

  // A root-owned test run could still write the read-only copy.
  it.skipIf(process.platform === 'win32' || process.getuid?.() === 0)(
    'caches the fix once when the game copy cannot be written',
    async () => {
      fs.chmodSync(gameCopy(), 0o444);
      vi.spyOn(console, 'warn').mockImplementation(() => undefined);
      const writes = vi.spyOn(fs.promises, 'writeFile');
      const cacheWrites = () =>
        writes.mock.calls.filter(([file]) => file === cacheCopy()).length;

      await checkInstallation(game);
      expect(cacheWrites()).toBe(1);
      expect(installed(cacheCopy())).toBe(false);

      expect((await checkInstallation(game))?.components?.achievements?.installed).toBe(
        false
      );
      expect(cacheWrites()).toBe(1);
    }
  );
});
