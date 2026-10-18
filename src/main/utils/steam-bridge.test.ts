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
vi.mock('@/main/utils/cef-flag-file', () => ({
  isCefFlagFilePresent: () => false,
  syncBridgePluginSetup: vi.fn(() => Promise.resolve()),
}));
vi.mock('@/main/utils/millennium', () => ({
  detectMillennium: vi.fn(),
  planEnabledPluginsEdit: vi.fn(),
}));
vi.mock('@/main/utils/millennium-plugin', () => ({
  getMillenniumPluginState: vi.fn(),
}));
vi.mock('@/main/utils/steam-bridge-server', () => ({
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
const { syncBridgePluginSetup } = await import('@/main/utils/cef-flag-file');
const { detectMillennium } = await import('@/main/utils/millennium');
const { getMillenniumPluginState } = await import('@/main/utils/millennium-plugin');
const { resolveCefEndpoint } = await import('@/main/utils/steam-cef');
const {
  computeBridgeFingerprint,
  computeBridgeStatusCode,
  getSteamBridgeStatus,
  nextVerifyStep,
  startSteamBridge,
} = await import('@/main/utils/steam-bridge');

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

  it('reports setting-off before anything else', () => {
    expect(
      computeBridgeStatusCode({
        ...healthy,
        settingOn: false,
        steamRunning: false,
        transport: 'plugin',
        millenniumGeneration: 'v2',
        verdictPresent: true,
      })
    ).toBe('setting-off');
  });

  it('reports steam-not-running before transport and Millennium', () => {
    expect(
      computeBridgeStatusCode({
        ...healthy,
        steamRunning: false,
        millenniumGeneration: 'v3',
        blocksTcpCdp: true,
        verdictPresent: true,
      })
    ).toBe('steam-not-running');
  });

  it('reports ok for either transport, even with Millennium or a stale verdict', () => {
    expect(computeBridgeStatusCode({ ...healthy, transport: 'cdp' })).toBe('ok');
    expect(
      computeBridgeStatusCode({
        ...healthy,
        transport: 'plugin',
        millenniumGeneration: 'v3',
        blocksTcpCdp: true,
        verdictPresent: true,
      })
    ).toBe('ok');
  });

  it('reports millennium-outdated for v2 ahead of the plugin path and the verdict', () => {
    expect(
      computeBridgeStatusCode({
        ...healthy,
        millenniumGeneration: 'v2',
        blocksTcpCdp: true,
        cdpOnPipe: true,
        verdictPresent: true,
      })
    ).toBe('millennium-outdated');
  });

  it('reports millennium-plugin-pending for v3 that blocks TCP CDP', () => {
    expect(
      computeBridgeStatusCode({
        ...healthy,
        millenniumGeneration: 'v3',
        blocksTcpCdp: true,
        verdictPresent: true,
      })
    ).toBe('millennium-plugin-pending');
  });

  it('reports millennium-plugin-pending when the webhelper runs CDP over a pipe', () => {
    expect(computeBridgeStatusCode({ ...healthy, cdpOnPipe: true })).toBe(
      'millennium-plugin-pending'
    );
  });

  it('does not block macOS Millennium v3, which keeps the TCP port', () => {
    expect(
      computeBridgeStatusCode({
        ...healthy,
        millenniumGeneration: 'v3',
        blocksTcpCdp: false,
      })
    ).toBe('restart-pending');
  });

  it('reports cef-blocked only from a persisted verdict', () => {
    expect(computeBridgeStatusCode({ ...healthy, verdictPresent: true })).toBe(
      'cef-blocked'
    );
  });

  it('falls back to restart-pending', () => {
    expect(computeBridgeStatusCode(healthy)).toBe('restart-pending');
  });
});

describe('nextVerifyStep', () => {
  const base = {
    pluginConnected: false,
    endpoint: false,
    discovery: null,
    millenniumV3: false,
  } as const;

  it('waits for the plugin when CDP is on a pipe and Millennium v3 is installed', () => {
    expect(nextVerifyStep({ ...base, discovery: 'pipe', millenniumV3: true })).toBe(
      'plugin-only'
    );
  });

  it('reports blocked for a pipe without Millennium v3', () => {
    expect(nextVerifyStep({ ...base, discovery: 'pipe' })).toBe('blocked');
  });

  it('prefers a connected plugin, then an open endpoint, else keeps polling', () => {
    expect(nextVerifyStep({ ...base, pluginConnected: true, endpoint: true })).toBe(
      'ready-plugin'
    );
    expect(nextVerifyStep({ ...base, endpoint: true, discovery: 'pipe' })).toBe(
      'ready-cdp'
    );
    expect(nextVerifyStep({ ...base, discovery: 'port' })).toBe('poll');
    expect(nextVerifyStep({ ...base, discovery: 'none', millenniumV3: true })).toBe(
      'poll'
    );
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
