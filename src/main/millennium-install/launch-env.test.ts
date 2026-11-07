import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type * as PlatformModule from '@/main/utils/platform';
import { installPathsFor } from './paths';
import { recordPathIn, writeInstallRecord } from './record';

const STEAM = '/home/u/.local/share/Steam';

vi.mock('@/main/game-detector/steam', () => ({ getSteamPath: () => STEAM }));
vi.mock('@/main/utils/host-exec', () => ({ isFlatpak: () => false }));
vi.mock('@/main/utils/platform', async (importOriginal) => ({
  ...(await importOriginal<typeof PlatformModule>()),
  isLinux: () => true,
}));

const { millenniumLaunchEnv } = await import('./launch-env');

let home = '';

beforeEach(() => {
  home = fs.mkdtempSync(path.join(os.tmpdir(), 'lbk-launch-env-'));
  vi.stubEnv('HOME', home);
  vi.stubEnv('XDG_DATA_HOME', '');
  vi.stubEnv('XDG_CONFIG_HOME', '');
  vi.stubEnv('MILLENNIUM_RUNTIME_PATH', '');
});

afterEach(() => {
  vi.unstubAllEnvs();
  fs.rmSync(home, { recursive: true, force: true });
});

function linuxPaths() {
  const paths = installPathsFor('linux', STEAM);
  if (!paths.linux) {
    throw new Error('no Linux paths');
  }
  return { root: paths.root, ...paths.linux };
}

const ourLib = () => path.posix.join(linuxPaths().current, 'libmillennium_x86.so');

describe.skipIf(process.platform === 'win32')('millenniumLaunchEnv', () => {
  it('points Steam at our runtime while LBK has the install', () => {
    const { root } = linuxPaths();
    writeInstallRecord(recordPathIn(root), {
      format: 1,
      os: 'linux',
      mode: 'linux-user',
      tag: 'v3.5.0',
      version: '3.5.0',
      activatedAt: '2026-10-15T00:00:00.000Z',
      steamPath: STEAM,
      xtstBackups: [],
    });
    expect(millenniumLaunchEnv()).toEqual({ MILLENNIUM_RUNTIME_PATH: ourLib() });
  });

  it.each([
    ['no variable', () => '', false, {}],
    ['a variable of another install', () => '/opt/millennium/x.so', false, {}],
    [
      'our stale variable',
      ourLib,
      false,
      { MILLENNIUM_RUNTIME_PATH: '/usr/lib/millennium/libmillennium_x86.so' },
    ],
    ['our variable while Steam still links our bootstrap', ourLib, true, {}],
  ])('without a record, passes on %s as it should', (_label, session, linked, env) => {
    vi.stubEnv('MILLENNIUM_RUNTIME_PATH', session());
    if (linked) {
      const { steamHome, current } = linuxPaths();
      fs.mkdirSync(path.posix.join(steamHome, 'ubuntu12_32'), { recursive: true });
      fs.symlinkSync(
        path.posix.join(current, 'libmillennium_bootstrap_x86.so'),
        path.posix.join(steamHome, 'ubuntu12_32/libXtst.so.6')
      );
    }
    expect(millenniumLaunchEnv()).toEqual(env);
  });
});
