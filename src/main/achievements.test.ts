import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AchievementsBadge } from '@/shared/plugin-host-types';
import type { AchievementsComponent } from '@/shared/types';

const state = vi.hoisted(() => ({
  root: '',
  pluginData: [] as unknown[],
  pluginConnected: false,
  settingOn: true,
  badge: 'needs-millennium' as AchievementsBadge['state'],
  reload: vi.fn(() => Promise.resolve({ apps: 1, coverage: {} })),
}));

vi.mock('electron', () => ({
  app: { getPath: () => path.join(state.root, 'userData') },
}));
vi.mock('@/main/game-detector/steam', () => ({
  getSteamPath: () => path.join(state.root, 'Steam'),
}));
vi.mock('@/main/installer/download-and-extract', () => ({
  downloadAndExtractArchive: vi.fn(),
}));
vi.mock('@/main/game-detector', () => ({ getFirstAvailableGamePath: vi.fn() }));
vi.mock('@/main/db/games-repository', () => ({ GamesRepository: {} }));
vi.mock('@/main/plugin-host/state', () => ({
  getAchievementsBadge: () =>
    Promise.resolve({ state: state.badge, unsupportedReason: null }),
}));
vi.mock('@/main/utils/plugin-data', () => ({
  writeBridgePluginData: (_file: string, data: unknown) => {
    state.pluginData.push(data);
  },
}));
vi.mock('@/main/steam-bridge-server/bridge-server', () => ({
  invokeViaPlugin: () => state.reload(),
  isPluginConnected: () => state.pluginConnected,
}));
vi.mock('@/main/utils/store-storage', () => ({
  getWorkshopInstalledGameIds: () => [],
  isCefDebuggingEnabledInSettings: () => state.settingOn,
}));

import { startAchievements, syncAchievementsToPlugin } from './achievements';
import {
  commitAchievementStrings,
  isAchievementsComponentCurrent,
  readAchievementStringsFromDir,
  removeInstalledAchievements,
} from './achievements/install';
import {
  hasAchievementStrings,
  saveAchievementStrings,
} from './achievements/strings-store';
import { appEvents } from './app-events';

const END = Buffer.from([0x08]);
const cstr = (s: string) => Buffer.concat([Buffer.from(s, 'utf8'), Buffer.from([0])]);
const obj = (key: string, ...kids: Buffer[]) =>
  Buffer.concat([Buffer.from([0x00]), cstr(key), ...kids, END]);
const str = (key: string, v: string) =>
  Buffer.concat([Buffer.from([0x01]), cstr(key), cstr(v)]);

const schema = (appId: number, name: string, desc: string) =>
  Buffer.concat([
    obj(
      String(appId),
      obj(
        'stats',
        obj(
          '1',
          obj(
            'bits',
            obj(
              '0',
              str('name', 'ACH_ONE'),
              obj(
                'display',
                obj('name', str('english', name)),
                obj('desc', str('english', desc))
              )
            )
          )
        )
      )
    ),
    END,
  ]);

const OURS = () => schema(400, 'Кекс для героя', 'Отримати кекс');
const OFFICIAL = () => schema(400, 'The Cake', 'Get the cake');

const statsDir = () => path.join(state.root, 'Steam', 'appcache', 'stats');
const statsFile = (name: string) => path.join(statsDir(), name);
const stringsFile = (appId: number) =>
  path.join(state.root, 'userData', 'achievement-strings', `${appId}.json`);

async function seedOurStrings(): Promise<void> {
  const dir = path.join(state.root, 'x');
  fs.mkdirSync(dir);
  fs.writeFileSync(path.join(dir, 'UserGameStatsSchema_400.bin'), OURS());
  saveAchievementStrings(await readAchievementStringsFromDir(dir), 'game-a', null);
}

beforeEach(() => {
  state.root = fs.mkdtempSync(path.join(os.tmpdir(), 'lbk-ach-'));
  fs.mkdirSync(statsDir(), { recursive: true });
  state.pluginData = [];
  state.pluginConnected = false;
  state.settingOn = true;
  state.badge = 'needs-millennium';
  state.reload.mockClear();
  vi.spyOn(console, 'log').mockImplementation(() => undefined);
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
  fs.rmSync(state.root, { recursive: true, force: true });
});

describe('achievement strings store', () => {
  it('extracts schemas from an archive dir and records the owner', async () => {
    const dir = path.join(state.root, 'extract', 'nested');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'UserGameStatsSchema_400.bin'), OURS());
    fs.writeFileSync(path.join(dir, 'UserGameStatsSchema_401.bin'), OFFICIAL());
    fs.writeFileSync(path.join(dir, 'readme.txt'), 'hello');

    const extracted = await readAchievementStringsFromDir(
      path.join(state.root, 'extract')
    );
    expect(extracted.map((e) => e.appId)).toEqual([400]);

    expect(saveAchievementStrings(extracted, 'game-a', 'hash-1')).toEqual([400]);
    expect(hasAchievementStrings([400], 'game-a')).toBe(true);
    expect(hasAchievementStrings([400], 'game-b')).toBe(false);
    expect(hasAchievementStrings([400, 401], 'game-a')).toBe(false);
    expect(hasAchievementStrings([], 'game-a')).toBe(false);
  });

  describe('isAchievementsComponentCurrent', () => {
    const current: AchievementsComponent = {
      installed: true,
      files: [],
      archiveHash: 'h',
      appIds: [400],
    };

    beforeEach(() => {
      saveAchievementStrings(
        [{ appId: 400, strings: { A: { name: 'Кекс' } } }],
        'game-a',
        'h'
      );
    });

    it('skips a re-install for the same archive whose strings the game owns', () => {
      expect(isAchievementsComponentCurrent(current, 'game-a', 'h')).toBe(true);
    });

    it.each<[string, AchievementsComponent | undefined, string, string | null]>([
      ['another archive', current, 'game-a', 'h2'],
      ['an unknown archive hash', current, 'game-a', null],
      ['strings another game owns', current, 'game-b', 'h'],
      ['a record without app ids', { ...current, appIds: [] }, 'game-a', 'h'],
      [
        'legacy .bin copies',
        { ...current, files: ['UserGameStatsSchema_400.bin'] },
        'game-a',
        'h',
      ],
      ['no record', undefined, 'game-a', 'h'],
    ])('re-installs for %s', (_case, component, gameId, hash) => {
      expect(isAchievementsComponentCurrent(component, gameId, hash)).toBe(false);
    });
  });

  it('leaves strings owned by another translation of the same app', async () => {
    await seedOurStrings();

    await removeInstalledAchievements('game-b', { files: [], appIds: [400] });
    expect(fs.existsSync(stringsFile(400))).toBe(true);

    await removeInstalledAchievements(
      'game-a',
      { files: [], appIds: [400] },
      new Set([400])
    );
    expect(fs.existsSync(stringsFile(400))).toBe(true);

    await removeInstalledAchievements('game-a', { files: [], appIds: [400] });
    expect(fs.existsSync(stringsFile(400))).toBe(false);
  });
});

describe('legacy appcache cleanup', () => {
  const file = 'UserGameStatsSchema_400.bin';

  it('restores the backup over our file', async () => {
    fs.writeFileSync(statsFile(file), OURS());
    fs.writeFileSync(statsFile(`${file}_backup`), OFFICIAL());
    await removeInstalledAchievements('game-a', { files: [file] });
    expect(fs.readFileSync(statsFile(file))).toEqual(OFFICIAL());
    expect(fs.existsSync(statsFile(`${file}_backup`))).toBe(false);
  });

  it('deletes our file when there is no backup', async () => {
    fs.writeFileSync(statsFile(file), OURS());
    await removeInstalledAchievements('game-a', { files: [file] });
    expect(fs.existsSync(statsFile(file))).toBe(false);
  });

  it('removes the strings of the app named by a legacy file', async () => {
    await seedOurStrings();

    await removeInstalledAchievements('game-a', { files: [file] });
    expect(fs.existsSync(stringsFile(400))).toBe(false);
  });
});

describe('syncAchievementsToPlugin', () => {
  it('writes the aggregate payload and reports the delivery', async () => {
    await seedOurStrings();
    expect(await syncAchievementsToPlugin()).toBe('needs-millennium');
    expect(state.pluginData.at(-1)).toMatchObject({
      v: 1,
      apps: { 400: { ACH_ONE: { name: 'Кекс для героя', desc: 'Отримати кекс' } } },
    });

    state.badge = 'after-restart';
    expect(await syncAchievementsToPlugin()).toBe('plugin-next-start');
    expect(state.reload).not.toHaveBeenCalled();

    state.badge = 'millennium';
    state.pluginConnected = true;
    expect(await syncAchievementsToPlugin()).toBe('plugin-live');
    expect(state.reload).toHaveBeenCalledTimes(1);

    state.reload.mockRejectedValueOnce(new Error('plugin-outdated'));
    expect(await syncAchievementsToPlugin()).toBe('plugin-next-start');

    state.settingOn = false;
    state.badge = 'setting-off';
    expect(await syncAchievementsToPlugin()).toBe('disabled');
  });

  it('keeps the stamp stable for unchanged data', async () => {
    await seedOurStrings();
    await syncAchievementsToPlugin();
    await syncAchievementsToPlugin();
    const [a, b] = state.pluginData as { stamp: string }[];
    expect(a.stamp).toBe(b.stamp);
  });
});

describe('startup', () => {
  it('drops legacy files, marks them not installed and prunes orphan strings', async () => {
    const file = 'UserGameStatsSchema_400.bin';
    fs.writeFileSync(statsFile(file), OURS());
    fs.writeFileSync(statsFile(`${file}_backup`), OFFICIAL());

    const gamePath = path.join(state.root, 'Game');
    fs.mkdirSync(gamePath);
    const info = {
      gameId: 'game-a',
      version: '1.0.0',
      installedAt: '2026-01-01T00:00:00.000Z',
      gamePath,
      installedPlatform: 'steam',
      components: {
        text: { installed: true, files: ['a.txt'] },
        achievements: { installed: true, files: [file], archiveHash: 'h' },
      },
    };
    const cacheDir = path.join(state.root, 'userData', 'installation-cache');
    fs.mkdirSync(cacheDir, { recursive: true });
    fs.writeFileSync(path.join(cacheDir, 'game-a.json'), JSON.stringify(info));
    fs.writeFileSync(path.join(gamePath, '.lbk-translation.json'), JSON.stringify(info));
    saveAchievementStrings(
      [{ appId: 500, strings: { ACH: { name: 'Сирота' } } }],
      'gone-game',
      'h2'
    );
    saveAchievementStrings(
      [{ appId: 700, strings: { ACH: { name: 'Своє' } } }],
      'game-a',
      'h3'
    );

    startAchievements();

    const copies = [
      path.join(cacheDir, 'game-a.json'),
      path.join(gamePath, '.lbk-translation.json'),
    ];
    await vi.waitFor(() => {
      for (const copy of copies) {
        expect(JSON.parse(fs.readFileSync(copy, 'utf8'))).toMatchObject({
          version: '1.0.0',
          installedPlatform: 'steam',
          components: {
            text: { installed: true, files: ['a.txt'] },
            achievements: { installed: false, files: [] },
          },
        });
      }
    });
    expect(fs.readFileSync(statsFile(file))).toEqual(OFFICIAL());
    expect(fs.existsSync(statsFile(`${file}_backup`))).toBe(false);
    await vi.waitFor(() => expect(fs.existsSync(stringsFile(500))).toBe(false));
    expect(fs.existsSync(stringsFile(700))).toBe(true);

    appEvents.emit('install-record-removed', 'game-a');
    expect(fs.existsSync(stringsFile(700))).toBe(false);
  });
});

describe('commitAchievementStrings', () => {
  const component = { installed: true, files: [], appIds: [600] };

  it('drops only the achievements when the strings cannot be written', async () => {
    fs.mkdirSync(path.join(state.root, 'userData'), { recursive: true });
    fs.writeFileSync(
      path.join(state.root, 'userData', 'achievement-strings'),
      'not a dir'
    );
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const result = await commitAchievementStrings({
      extracted: [{ appId: 600, strings: { ACH: { name: 'Перемога' } } }],
      gameId: 'game-b',
      archiveHash: 'h',
      component,
      previous: null,
    });

    expect(result).toBeNull();
  });

  it('keeps the component and replaces the previous strings on success', async () => {
    saveAchievementStrings(
      [{ appId: 700, strings: { OLD: { name: 'Старе' } } }],
      'game-b',
      'old'
    );

    const result = await commitAchievementStrings({
      extracted: [{ appId: 600, strings: { ACH: { name: 'Перемога' } } }],
      gameId: 'game-b',
      archiveHash: 'h',
      component,
      previous: {
        gameId: 'game-b',
        component: { installed: true, files: [], appIds: [700] },
      },
    });

    expect(result).toEqual(component);
    expect(fs.existsSync(stringsFile(600))).toBe(true);
    expect(fs.existsSync(stringsFile(700))).toBe(false);
  });
});
