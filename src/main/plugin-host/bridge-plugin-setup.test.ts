import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { syncBridgePluginSetup } from '@/main/plugin-host/bridge-plugin-setup';
import type { PendingSteamAction } from '@/main/steam-pending-actions/queue';
import {
  getMillenniumPluginState,
  installOrUpdateMillenniumPlugin,
  setMillenniumPluginEnabledInConfig,
} from '@/main/utils/millennium-plugin';

const env = vi.hoisted(() => ({
  settingOn: true,
  generation: null as 'v3' | null,
  queue: [] as PendingSteamAction[],
}));

vi.mock('@/main/steam-pending-actions', () => ({
  queueSteamAction: vi.fn((action: PendingSteamAction) => env.queue.push(action)),
}));
vi.mock('@/main/steam-pending-actions/queue', () => ({
  getPendingSteamActions: () => env.queue,
}));
vi.mock('@/main/steam-bridge-server/bridge-server', () => ({
  startSteamBridgeServer: vi.fn(() => Promise.resolve()),
  stopSteamBridgeServer: vi.fn(),
}));
vi.mock('@/main/utils/cef-flag-file', () => ({
  ensureCefFlagFile: vi.fn(),
  removeCefFlagFile: vi.fn(),
}));
vi.mock('@/main/utils/decky', () => ({
  detectDeckyPluginSync: () => null,
  isDeckyInstalledSync: () => false,
}));
vi.mock('@/main/utils/millennium', () => ({
  detectMillennium: () => ({
    blocksTcpCdp: false,
    generation: env.generation,
    pluginsDir: '/mill/plugins',
    configPath: '/mill/config.json',
  }),
}));
vi.mock('@/main/utils/millennium-plugin', () => ({
  getMillenniumPluginState: vi.fn(),
  installOrUpdateMillenniumPlugin: vi.fn(),
  removeMillenniumPluginFiles: vi.fn(),
  setMillenniumPluginEnabledInConfig: vi.fn(),
}));
vi.mock('@/main/utils/plugin-data', () => ({
  removeOrphanDeckyPluginData: vi.fn(),
  resyncBridgePluginData: vi.fn(),
}));
vi.mock('@/main/utils/steam-bridge', () => ({
  claimSteamRestartPrompt: vi.fn(),
  clearSteamBridgeVerdict: vi.fn(),
  refreshSteamBridgeStatus: vi.fn(),
}));
vi.mock('@/main/utils/steam-cef', () => ({ resetCefEndpointCache: vi.fn() }));
vi.mock('@/main/utils/store-storage', () => ({
  isCefDebuggingEnabledInSettings: () => env.settingOn,
}));
vi.mock('@/main/window', () => ({ sendToRenderer: () => undefined }));

beforeEach(() => {
  env.settingOn = true;
  env.generation = null;
  env.queue = [];
  vi.spyOn(console, 'log').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
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
