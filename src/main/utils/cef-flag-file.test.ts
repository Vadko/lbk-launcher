import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { restoreCefFlagFileAfterMillennium } from './cef-flag-file';

const env = vi.hoisted(() => ({
  steamPath: '',
  settingOn: true,
  blocksTcpCdp: false,
}));

vi.mock('@/main/game-detector/steam', () => ({ getSteamPath: () => env.steamPath }));
vi.mock('./millennium', () => ({
  detectMillennium: () => ({ blocksTcpCdp: env.blocksTcpCdp }),
}));
vi.mock('./platform', () => ({ isMacOS: () => false }));
vi.mock('./store-storage', () => ({
  isCefDebuggingEnabledInSettings: () => env.settingOn,
}));

const flag = () => path.join(env.steamPath, '.cef-enable-remote-debugging');

beforeEach(() => {
  env.steamPath = fs.mkdtempSync(path.join(os.tmpdir(), 'lbk-cef-'));
  env.settingOn = true;
  env.blocksTcpCdp = false;
  vi.spyOn(console, 'log').mockImplementation(() => undefined);
});

afterEach(() => {
  fs.rmSync(env.steamPath, { recursive: true, force: true });
  vi.restoreAllMocks();
});

describe('restoreCefFlagFileAfterMillennium', () => {
  it('brings back the flag file Millennium deleted', () => {
    restoreCefFlagFileAfterMillennium();
    expect(fs.existsSync(flag())).toBe(true);
  });

  it('leaves it off when the setting is off or Millennium still blocks CDP', () => {
    env.settingOn = false;
    restoreCefFlagFileAfterMillennium();
    env.settingOn = true;
    env.blocksTcpCdp = true;
    restoreCefFlagFileAfterMillennium();
    expect(fs.existsSync(flag())).toBe(false);
  });
});
