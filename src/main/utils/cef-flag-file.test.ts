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
vi.mock('@/main/steam-pending-actions', () => ({ queueSteamAction: vi.fn() }));
vi.mock('@/main/window', () => ({ getMainWindow: () => null }));
vi.mock('./decky', () => ({
  detectDeckyPluginSync: () => null,
  isDeckyInstalledSync: () => false,
}));
vi.mock('./millennium', () => ({
  detectMillennium: () => ({ blocksTcpCdp: env.blocksTcpCdp, generation: null }),
}));
vi.mock('./millennium-plugin', () => ({
  getMillenniumPluginState: vi.fn(),
  installOrUpdateMillenniumPlugin: vi.fn(),
  removeMillenniumPluginFiles: vi.fn(),
  setMillenniumPluginEnabledInConfig: vi.fn(),
}));
vi.mock('./platform', () => ({ isMacOS: () => false }));
vi.mock('./plugin-data', () => ({
  removeOrphanDeckyPluginData: vi.fn(),
  resyncBridgePluginData: vi.fn(),
}));
vi.mock('./steam-bridge', () => ({
  claimSteamRestartPrompt: vi.fn(),
  clearSteamBridgeVerdict: vi.fn(),
  refreshSteamBridgeStatus: vi.fn(),
}));
vi.mock('./steam-bridge-server', () => ({
  startSteamBridgeServer: vi.fn(async () => undefined),
  stopSteamBridgeServer: vi.fn(),
}));
vi.mock('./steam-cef', () => ({ resetCefEndpointCache: vi.fn() }));
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
