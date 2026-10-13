import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { startSteamWatcher, stopSteamWatcher } from './steam-watcher';

const steam = vi.hoisted(() => ({
  path: '',
  licensecacheSize: 100,
  lastKnownLicensecacheSize: 100,
}));

vi.mock('./game-detector/steam', () => ({
  getSteamPath: () => steam.path,
  getLicensecachePath: () => path.join(steam.path, 'userdata/1/config/licensecache'),
  getLicensecacheSize: () => steam.licensecacheSize,
  getLastKnownLicensecacheSize: () => steam.lastKnownLicensecacheSize,
  updateLastKnownLicensecacheSize: (size: number) => {
    steam.lastKnownLicensecacheSize = size;
  },
  invalidateSteamInstalledCaches: vi.fn(),
  invalidateSteamLibraryAppIdsCache: vi.fn(),
}));

// Longer than the watcher's 2 s debounce
const SETTLE_MS = 2600;
const settle = () => new Promise((resolve) => setTimeout(resolve, SETTLE_MS));

let root: string;
const send = vi.fn();
const mainWindow = { webContents: { send } } as unknown as Electron.BrowserWindow;

// Steam writes these files to a temp name and renames it over the original
function replaceFile(file: string, content: string): void {
  fs.writeFileSync(`${file}.tmp`, content);
  fs.renameSync(`${file}.tmp`, file);
}

function libraryFoldersVdf(paths: string[]): string {
  const entries = paths
    .map((p, i) => `\t"${i}"\n\t{\n\t\t"path"\t\t"${p}"\n\t\t"apps"\n\t\t{\n\t\t}\n\t}`)
    .join('\n');
  return `"libraryfolders"\n{\n${entries}\n}\n`;
}

const vdfPath = () => path.join(steam.path, 'steamapps/libraryfolders.vdf');
const licensecachePath = () => path.join(steam.path, 'userdata/1/config/licensecache');

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'lbk-steam-'));
  steam.path = path.join(root, 'Steam');
  fs.mkdirSync(path.join(steam.path, 'steamapps'), { recursive: true });
  fs.mkdirSync(path.join(root, 'SecondLibrary/steamapps'), { recursive: true });
  fs.mkdirSync(path.dirname(licensecachePath()), { recursive: true });
  fs.writeFileSync(vdfPath(), libraryFoldersVdf([steam.path]));
  fs.writeFileSync(licensecachePath(), 'x'.repeat(100));
  steam.licensecacheSize = 100;
  steam.lastKnownLicensecacheSize = 100;
  send.mockClear();
  startSteamWatcher(mainWindow);
});

afterEach(() => {
  stopSteamWatcher();
  fs.rmSync(root, { recursive: true, force: true });
});

describe('steam-watcher', { timeout: 15_000 }, () => {
  it('picks up a library added after Steam replaced libraryfolders.vdf', async () => {
    // A rewrite that keeps the folder list (Steam updates app lists and sizes) must not restart anything
    replaceFile(vdfPath(), libraryFoldersVdf([steam.path]));
    await settle();
    expect(send).not.toHaveBeenCalled();

    const secondLibrary = path.join(root, 'SecondLibrary');
    replaceFile(vdfPath(), libraryFoldersVdf([steam.path, secondLibrary]));
    await settle();
    expect(send).toHaveBeenCalledWith('steam-library-changed');

    // The new library's steamapps is now watched, and the vdf watcher survived both replacements
    send.mockClear();
    fs.writeFileSync(
      path.join(secondLibrary, 'steamapps/appmanifest_42.acf'),
      '"AppState"{}'
    );
    await settle();
    expect(send).toHaveBeenCalledWith('steam-library-changed');
  });

  it('notices a purchase after Steam replaced licensecache more than once', async () => {
    steam.licensecacheSize = 120;
    replaceFile(licensecachePath(), 'x'.repeat(120));
    await settle();
    expect(send).toHaveBeenCalledWith('steam-library-changed');

    send.mockClear();
    steam.licensecacheSize = 140;
    replaceFile(licensecachePath(), 'x'.repeat(140));
    await settle();
    expect(send).toHaveBeenCalledWith('steam-library-changed');
  });
});
