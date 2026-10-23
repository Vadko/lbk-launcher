import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { addEglLaunchArgs, readEglLaunchArgs } from './egl-game-settings';

vi.mock('./platform', () => ({
  isLinux: () => true,
  isMacOS: () => false,
  isWindows: () => false,
}));

const APP_ID =
  '1311a5735ed844c0b3c47027cab321f0:f1b123b2f48840b5b2b0322541fcbddb:c5109bdceb3a453bb38c2fdc964ddee8';

const homes: string[] = [];

afterEach(() => {
  vi.unstubAllEnvs();
  for (const home of homes.splice(0)) {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

function setUpHome(settings?: unknown) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'lbk-egl-settings-'));
  homes.push(home);
  vi.stubEnv('HOME', home);
  vi.stubEnv('USERPROFILE', home);
  vi.stubEnv('XDG_DATA_HOME', undefined);
  vi.stubEnv('FLATPAK_ID', undefined);
  const root = path.join(home, '.local/share/com.epicgames.eglv2');
  const dir = path.join(home, 'Games', 'DokiDokiLitClubPlus');
  fs.mkdirSync(dir, { recursive: true });
  fs.mkdirSync(root, { recursive: true });
  const [namespace, itemId, artifactId] = APP_ID.split(':');
  fs.writeFileSync(
    path.join(root, 'installations.jsonl'),
    JSON.stringify({
      installationId: 'X',
      complete: true,
      dir,
      namespace,
      itemId,
      artifactId,
    })
  );
  const file = path.join(root, 'settings/game-settings.json');
  if (settings !== undefined) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(
      file,
      typeof settings === 'string' ? settings : JSON.stringify(settings)
    );
  }
  return { dir, file };
}

function readSettings(file: string) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

describe('EGL per-game launch arguments', () => {
  it('creates the file in the shape EGL writes when it has none yet', () => {
    const { dir, file } = setUpHome();

    expect(addEglLaunchArgs(dir, `-mod=a,b "Two Words"`)).toBe(true);

    expect(readSettings(file)).toEqual({
      games: {
        [APP_ID]: {
          autoUpdate: true,
          priorityDownload: false,
          additionalCommandsEnabled: true,
          additionalCommands: '-mod=a,b "Two Words"',
        },
      },
      addons: {},
      cloudSaves: {},
      pendingShortcuts: {},
    });
    expect(readEglLaunchArgs(dir)).toEqual(['-mod=a,b', 'Two Words']);
  });

  it('keeps the player args, other games and EGL fields, and adds nothing twice', () => {
    const other = { additionalCommandsEnabled: true, additionalCommands: '-other' };
    const { dir, file } = setUpHome({
      games: {
        [APP_ID]: {
          autoUpdate: false,
          priorityDownload: true,
          additionalCommandsEnabled: true,
          additionalCommands: '-windowed',
        },
        'ns:item:other': other,
      },
      addons: { a: 1 },
      cloudSaves: {},
      pendingShortcuts: {},
    });

    addEglLaunchArgs(dir, '-load-mods');
    const written = fs.readFileSync(file, 'utf8');
    fs.utimesSync(file, 0, 0);
    expect(addEglLaunchArgs(dir, '-load-mods')).toBe(true);
    expect(fs.statSync(file).mtimeMs).toBe(0);
    expect(fs.readFileSync(file, 'utf8')).toBe(written);

    const settings = readSettings(file);
    expect(settings.games[APP_ID]).toEqual({
      autoUpdate: false,
      priorityDownload: true,
      additionalCommandsEnabled: true,
      additionalCommands: '-windowed -load-mods',
    });
    expect(settings.games['ns:item:other']).toEqual(other);
    expect(settings.addons).toEqual({ a: 1 });
  });

  it('ignores args the player switched off, and turns its own on', () => {
    const { dir, file } = setUpHome({
      games: {
        [APP_ID]: { additionalCommandsEnabled: false, additionalCommands: '-old' },
      },
    });
    expect(readEglLaunchArgs(dir)).toEqual([]);

    addEglLaunchArgs(dir, '-load-mods');

    expect(readSettings(file).games[APP_ID]).toMatchObject({
      additionalCommandsEnabled: true,
      additionalCommands: '-load-mods',
    });
  });

  it('leaves a file it cannot parse alone', () => {
    const { dir, file } = setUpHome('{broken');

    expect(addEglLaunchArgs(dir, '-load-mods')).toBe(false);
    expect(fs.readFileSync(file, 'utf8')).toBe('{broken');
  });

  it('writes nothing for a folder EGL does not know', () => {
    const { file } = setUpHome();

    expect(addEglLaunchArgs('/somewhere/else', '-load-mods')).toBe(false);
    expect(fs.existsSync(file)).toBe(false);
  });

  it('adds the games map to a file EGL wrote without one', () => {
    const { dir, file } = setUpHome({ addons: {}, cloudSaves: { x: true } });

    addEglLaunchArgs(dir, '-load-mods');

    expect(readSettings(file)).toEqual({
      addons: {},
      cloudSaves: { x: true },
      games: {
        [APP_ID]: {
          autoUpdate: true,
          priorityDownload: false,
          additionalCommandsEnabled: true,
          additionalCommands: '-load-mods',
        },
      },
    });
  });
});
