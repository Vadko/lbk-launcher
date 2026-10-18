import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PendingSteamAction } from '@/main/steam-pending-actions';
import {
  restoreCefFlagFileAfterMillennium,
  syncBridgePluginSetup,
} from './cef-flag-file';
import {
  getMillenniumPluginState,
  installOrUpdateMillenniumPlugin,
  setMillenniumPluginEnabledInConfig,
} from './millennium-plugin';

const env = vi.hoisted(() => ({
  steamPath: '',
  settingOn: true,
  blocksTcpCdp: false,
  generation: null as 'v3' | null,
  queue: [] as PendingSteamAction[],
}));

vi.mock('@/main/game-detector/steam', () => ({ getSteamPath: () => env.steamPath }));
vi.mock('@/main/steam-pending-actions', () => ({
  getPendingSteamActions: () => env.queue,
  queueSteamAction: vi.fn((action: PendingSteamAction) => env.queue.push(action)),
}));
vi.mock('@/main/window', () => ({ sendToRenderer: () => undefined }));
vi.mock('./decky', () => ({
  detectDeckyPluginSync: () => null,
  isDeckyInstalledSync: () => false,
}));
vi.mock('./millennium', () => ({
  detectMillennium: () => ({
    blocksTcpCdp: env.blocksTcpCdp,
    generation: env.generation,
    pluginsDir: '/mill/plugins',
    configPath: '/mill/config.json',
  }),
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
  env.generation = null;
  env.queue = [];
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

describe('syncBridgePluginSetup with Millennium v3', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    env.generation = 'v3';
    vi.mocked(getMillenniumPluginState).mockReturnValue({
      supported: true,
      installed: true,
      installedVersion: '1.1.0',
      enabled: false,
      dir: '/mill/plugins/lbk-bridge',
    });
  });

  it('enables the plugin only after an install that went through', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const install = vi.mocked(installOrUpdateMillenniumPlugin);
    install.mockReturnValueOnce({ ok: false, error: 'EBUSY' });
    install.mockReturnValue({ ok: true, changed: true });
    vi.mocked(setMillenniumPluginEnabledInConfig).mockResolvedValue('changed');

    await syncBridgePluginSetup();
    expect(setMillenniumPluginEnabledInConfig).not.toHaveBeenCalled();
    await syncBridgePluginSetup();
    expect(setMillenniumPluginEnabledInConfig).toHaveBeenCalledWith(true);
  });

  it('queues the enable once while Steam runs instead of on every sync', async () => {
    vi.mocked(installOrUpdateMillenniumPlugin).mockReturnValue({
      ok: true,
      changed: false,
    });
    vi.mocked(setMillenniumPluginEnabledInConfig).mockResolvedValue('steam-running');

    await syncBridgePluginSetup();
    await syncBridgePluginSetup();

    expect(setMillenniumPluginEnabledInConfig).toHaveBeenCalledTimes(1);
    expect(env.queue).toMatchObject([{ kind: 'millennium-plugin', enable: true }]);
  });
});
