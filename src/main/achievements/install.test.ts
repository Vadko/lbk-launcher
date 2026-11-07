import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AchievementsComponent, Game, Platform } from '@/shared/types';

const state = vi.hoisted(() => ({ root: '' }));

vi.mock('electron', () => ({
  app: { getPath: () => path.join(state.root, 'userData') },
}));
vi.mock('@/main/game-detector/steam', () => ({
  getSteamPath: () => path.join(state.root, 'Steam'),
}));
// An archive whose only schema has no Ukrainian strings
vi.mock('@/main/installer/download-and-extract', () => ({
  downloadAndExtractArchive: vi.fn(({ extractDir }: { extractDir: string }) => {
    fs.mkdirSync(extractDir, { recursive: true });
    fs.writeFileSync(path.join(extractDir, 'UserGameStatsSchema_400.bin'), 'junk');
    return Promise.resolve();
  }),
}));

const { prepareAchievements } = await import('./install');
const { saveAchievementStrings } = await import('./strings-store');

const INSTALLED: AchievementsComponent = {
  installed: true,
  files: [],
  archiveHash: 'old',
  appIds: [400],
};

const game = (archivePath: string | null) =>
  ({
    id: 'game-a',
    achievements_archive_path: archivePath,
    achievements_archive_hash: 'new',
  }) as Game;

const prepare = (archivePath: string | null, platform: Platform, wanted = true) =>
  prepareAchievements({
    game: game(archivePath),
    platform,
    wanted,
    existing: INSTALLED,
    downloadDir: path.join(state.root, 'download'),
    isFirstSession: false,
  });

beforeEach(() => {
  state.root = fs.mkdtempSync(path.join(os.tmpdir(), 'lbk-ach-install-'));
  saveAchievementStrings(
    [{ appId: 400, strings: { A: { name: 'Cupcake' } } }],
    { gameId: 'game-a', gamePath: path.join(state.root, 'Game') },
    'old'
  );
  vi.spyOn(console, 'log').mockImplementation(() => undefined);
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
  fs.rmSync(state.root, { recursive: true, force: true });
});

describe('prepareAchievements', () => {
  it.each<[string, string | null, Platform]>([
    ['no archive in the catalog', null, 'steam'],
    ['an install outside Steam', 'ach.zip', 'gog'],
    ['an archive without Ukrainian strings', 'ach.zip', 'steam'],
  ])('keeps the installed strings for %s', async (_case, archivePath, platform) => {
    const prepared = await prepare(archivePath, platform);

    expect(prepared).toMatchObject({ extracted: [], component: INSTALLED });
  });

  it('drops them only when they are not wanted', async () => {
    expect((await prepare('ach.zip', 'steam', false)).component).toBeNull();
  });

  it.each<[string, AchievementsComponent]>([
    ['legacy .bin copies', { ...INSTALLED, files: ['UserGameStatsSchema_400.bin'] }],
    ['strings no longer on disk', { ...INSTALLED, appIds: [401] }],
  ])('keeps nothing for %s', async (_case, existing) => {
    const prepared = await prepareAchievements({
      game: game(null),
      platform: 'steam',
      wanted: true,
      existing,
      downloadDir: path.join(state.root, 'download'),
      isFirstSession: false,
    });

    expect(prepared.component).toBeNull();
  });
});
