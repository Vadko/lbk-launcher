import { describe, expect, it, vi } from 'vitest';

// Only the pure helpers are under test; everything that reaches Steam, Electron or disk is stubbed.
vi.mock('@/main/game-detector/steam', () => ({ getSteamPath: () => null }));
vi.mock('@/main/steam-pending-actions/queue', () => ({
  getPendingSteamActions: () => [],
}));
vi.mock('@/main/window', () => ({ sendToRenderer: () => undefined }));
vi.mock('@/main/plugin-host/state', () => ({
  deckyStateFor: () => null,
  getAchievementsBadge: vi.fn(),
  getHostSnapshot: () => Promise.resolve({ host: 'none', decky: null }),
}));
vi.mock('@/main/utils/cef-flag-file', () => ({ isCefFlagFilePresent: () => false }));
vi.mock('@/main/plugin-host/bridge-plugin-setup', () => ({
  syncBridgePluginSetup: vi.fn(() => Promise.resolve()),
}));
vi.mock('@/main/utils/millennium', () => ({
  detectMillennium: vi.fn(),
  planEnabledPluginsEdit: vi.fn(),
}));
vi.mock('@/main/utils/millennium-plugin', () => ({
  getMillenniumPluginState: vi.fn(),
}));
vi.mock('@/main/steam-bridge-server/bridge-server', () => ({
  invokeViaPlugin: vi.fn(),
  isPluginConnected: () => false,
}));
vi.mock('@/main/utils/steam-cef', () => ({
  invokeViaCdp: vi.fn(),
  resetCefEndpointCache: () => undefined,
  resolveCefEndpoint: vi.fn(),
}));
vi.mock('@/main/steam-process/lifecycle', () => ({
  findSteamPids: () => Promise.resolve([]),
  isSteamElevated: () => Promise.resolve(false),
}));
vi.mock('@/main/utils/store-storage', () => ({
  deleteStoreValue: vi.fn(),
  isCefDebuggingEnabledInSettings: () => true,
  readStoreValue: () => undefined,
  writeStoreValue: vi.fn(),
}));

const { appEvents } = await import('@/main/app-events');
const { syncBridgePluginSetup } = await import('@/main/plugin-host/bridge-plugin-setup');
const { detectMillennium } = await import('@/main/utils/millennium');
const { getMillenniumPluginState } = await import('@/main/utils/millennium-plugin');
const { resolveCefEndpoint } = await import('@/main/utils/steam-cef');
const { computeBridgeStatusCode, getSteamBridgeStatus } = await import(
  '@/main/utils/steam-bridge'
);
const { nextVerifyStep, startSteamBridge } = await import(
  '@/main/utils/steam-bridge-lifecycle'
);
const { computeBridgeFingerprint } = await import('@/main/utils/steam-bridge-verdict');

describe('computeBridgeFingerprint', () => {
  const base = {
    millenniumEvidence: ['windows:millennium/lib/millennium.dll', 'windows:wsock32.dll'],
    steamClientMtimeMs: 1_760_000_000_000,
    flagPresent: true,
  };

  it('is a stable sha1 hex digest', () => {
    const fp = computeBridgeFingerprint(base);
    expect(fp).toMatch(/^[0-9a-f]{40}$/);
    expect(computeBridgeFingerprint({ ...base })).toBe(fp);
  });

  it('ignores the order of Millennium evidence', () => {
    expect(
      computeBridgeFingerprint({
        ...base,
        millenniumEvidence: [...base.millenniumEvidence].reverse(),
      })
    ).toBe(computeBridgeFingerprint(base));
  });

  it('does not mutate the evidence array', () => {
    const evidence = ['b', 'a'];
    computeBridgeFingerprint({ ...base, millenniumEvidence: evidence });
    expect(evidence).toEqual(['b', 'a']);
  });

  it.each([
    ['a Steam client update', { steamClientMtimeMs: 1_760_000_000_001 }],
    ['an unknown client build', { steamClientMtimeMs: null }],
    ['the flag file disappearing', { flagPresent: false }],
    ['Millennium appearing', { millenniumEvidence: [] }],
  ])('changes on %s', (_label, change) => {
    expect(computeBridgeFingerprint({ ...base, ...change })).not.toBe(
      computeBridgeFingerprint(base)
    );
  });
});

describe('computeBridgeStatusCode', () => {
  const healthy = {
    settingOn: true,
    steamRunning: true,
    transport: null,
    millenniumGeneration: null,
    blocksTcpCdp: false,
    cdpOnPipe: false,
    verdictPresent: false,
  } as const;
  const blockingV3 = { millenniumGeneration: 'v3', blocksTcpCdp: true } as const;

  it.each([
    [
      'setting-off before anything else',
      {
        settingOn: false,
        steamRunning: false,
        transport: 'plugin',
        millenniumGeneration: 'v2',
        verdictPresent: true,
      },
      'setting-off',
    ],
    [
      'steam-not-running before transport and Millennium',
      { steamRunning: false, ...blockingV3, verdictPresent: true },
      'steam-not-running',
    ],
    ['ok over CDP', { transport: 'cdp' }, 'ok'],
    [
      'ok over the plugin, even with Millennium and a stale verdict',
      { transport: 'plugin', ...blockingV3, verdictPresent: true },
      'ok',
    ],
    [
      'millennium-outdated for v2 ahead of the plugin path and the verdict',
      {
        millenniumGeneration: 'v2',
        blocksTcpCdp: true,
        cdpOnPipe: true,
        verdictPresent: true,
      },
      'millennium-outdated',
    ],
    [
      'millennium-plugin-pending for v3 that blocks TCP CDP',
      { ...blockingV3, verdictPresent: true },
      'millennium-plugin-pending',
    ],
    [
      'millennium-plugin-pending when the webhelper runs CDP over a pipe',
      { cdpOnPipe: true },
      'millennium-plugin-pending',
    ],
    [
      'restart-pending for macOS Millennium v3, which keeps the TCP port',
      { millenniumGeneration: 'v3' },
      'restart-pending',
    ],
    [
      'cef-blocked only from a persisted verdict',
      { verdictPresent: true },
      'cef-blocked',
    ],
    ['restart-pending as the fallback', {}, 'restart-pending'],
  ] as const)('reports %s', (_label, change, code) => {
    expect(computeBridgeStatusCode({ ...healthy, ...change })).toBe(code);
  });
});

describe('nextVerifyStep', () => {
  const base = {
    pluginConnected: false,
    endpoint: false,
    discovery: null,
    millenniumV3: false,
  } as const;

  it.each([
    [{ discovery: 'pipe', millenniumV3: true }, 'plugin-only'],
    [{ discovery: 'pipe' }, 'blocked'],
    [{ pluginConnected: true, endpoint: true }, 'ready-plugin'],
    [{ endpoint: true, discovery: 'pipe' }, 'ready-cdp'],
    [{ discovery: 'port' }, 'poll'],
    [{ discovery: 'none', millenniumV3: true }, 'poll'],
  ] as const)('%o → %s', (change, step) => {
    expect(nextVerifyStep({ ...base, ...change })).toBe(step);
  });
});

describe('plugin setup', () => {
  it('runs on startup and around Steam restarts, never while computing the status', async () => {
    vi.mocked(detectMillennium).mockReturnValue({
      installed: false,
      generation: null,
      blocksTcpCdp: false,
      pluginsDir: null,
      configPath: null,
      evidence: [],
    });
    vi.mocked(getMillenniumPluginState).mockReturnValue({
      supported: false,
      installed: false,
      installedVersion: null,
      enabled: false,
      dir: null,
    });
    vi.mocked(resolveCefEndpoint).mockResolvedValue({
      steamRunning: false,
      endpoint: null,
      discovery: null,
    });
    const setup = vi.mocked(syncBridgePluginSetup);

    startSteamBridge();
    expect(setup).toHaveBeenCalledTimes(1);
    await getSteamBridgeStatus();
    expect(setup).toHaveBeenCalledTimes(1);
    appEvents.emit('steam-started');
    appEvents.emit('steam-exited');
    expect(setup).toHaveBeenCalledTimes(3);
  });
});
