import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { WinePrefixRef } from '@/shared/wine-types';
import { wineCommand } from './run';

const mocks = vi.hoisted(() => ({
  crossOverWine: null as string | null,
  standaloneWine: null as string | null,
}));

vi.mock('./crossover', () => ({ findCrossOverWine: () => mocks.crossOverWine }));
vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof fs>();
  return { ...actual, existsSync: (file: string) => file === mocks.standaloneWine };
});

const CROSSOVER_WINE =
  '/Applications/CrossOver.app/Contents/SharedSupport/CrossOver/bin/wine';
const BREW_WINE = '/opt/homebrew/bin/wine';

let root: string;
let prefix: string;
let gameDir: string;

beforeAll(() => {
  root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'lbk-wine-run-')));
  prefix = path.join(root, 'Bottle');
  gameDir = path.join(prefix, 'drive_c', 'Games', 'Ihor');
  fs.mkdirSync(gameDir, { recursive: true });
  fs.mkdirSync(path.join(prefix, 'dosdevices'));
  fs.writeFileSync(path.join(prefix, 'system.reg'), '');
  fs.symlinkSync('../drive_c', path.join(prefix, 'dosdevices', 'c:'));
});

afterAll(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

beforeEach(() => {
  mocks.crossOverWine = CROSSOVER_WINE;
  mocks.standaloneWine = BREW_WINE;
});

const ref = (launcher: WinePrefixRef['launcher']): WinePrefixRef => ({
  launcher,
  prefix,
  label: 'Bottle',
});

describe('wineCommand', () => {
  it.each([
    ['an exe, waited for', 'setup.exe', 'wait', ['C:\\Games\\Ihor\\setup.exe', '/S']],
    [
      'a batch file, through cmd',
      'install.bat',
      'wait',
      ['cmd', '/c', 'C:\\Games\\Ihor\\install.bat', '/S'],
    ],
    [
      'an msi, through msiexec',
      'patch.msi',
      'wait',
      ['msiexec', '/i', 'C:\\Games\\Ihor\\patch.msi', '/S'],
    ],
  ] as const)('CrossOver runs %s by its Windows path', (_label, file, mode, program) => {
    const command = wineCommand(ref('crossover'), path.join(gameDir, file), ['/S'], mode);
    expect(command?.file).toBe(CROSSOVER_WINE);
    expect(command?.args).toEqual([
      '--bottle',
      prefix,
      '--no-gui',
      '--wait-children',
      ...program,
    ]);
  });

  it('starts a CrossOver program without waiting', () => {
    const command = wineCommand(
      ref('crossover'),
      path.join(gameDir, 'steam.exe'),
      [],
      'detach'
    );
    expect(command?.args).toEqual([
      '--bottle',
      prefix,
      '--no-gui',
      '--no-wait',
      'C:\\Games\\Ihor\\steam.exe',
    ]);
  });

  it.each([
    ['wait', ['C:\\Games\\Ihor\\setup.exe']],
    ['detach', ['start', '/unix', 'HOST']],
  ] as const)('a hand-added prefix runs its Wine with WINEPREFIX (%s)', (mode, args) => {
    const hostFile = path.join(gameDir, 'setup.exe');
    const command = wineCommand(ref('manual'), hostFile, [], mode);
    expect(command?.file).toBe(BREW_WINE);
    expect(command?.args).toEqual(args.map((arg) => (arg === 'HOST' ? hostFile : arg)));
    expect(command?.env.WINEPREFIX).toBe(prefix);
  });

  it.each([
    [
      'CrossOver is gone',
      'crossover',
      () => {
        mocks.crossOverWine = null;
      },
    ],
    [
      'no Wine is installed',
      'manual',
      () => {
        mocks.standaloneWine = null;
      },
    ],
  ] as const)('gives null when %s', (_label, launcher, uninstall) => {
    uninstall();
    expect(
      wineCommand(ref(launcher), path.join(gameDir, 'setup.exe'), [], 'wait')
    ).toBeNull();
  });

  it('gives null for a file on no drive of the prefix', () => {
    expect(wineCommand(ref('crossover'), '/usr/bin/true', [], 'wait')).toBeNull();
  });
});
