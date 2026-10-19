import type { PluginHostState, SteamBridgeStatus } from '@/shared/plugin-host-types';

type DeckyState = NonNullable<PluginHostState['decky']>;

interface PluginHostOverrides extends Partial<Omit<PluginHostState, 'millennium'>> {
  millennium?: Partial<PluginHostState['millennium']>;
}

export function pluginHostState(overrides: PluginHostOverrides = {}): PluginHostState {
  const { millennium, ...rest } = overrides;
  return {
    host: 'millennium',
    decky: null,
    deckyLoader: null,
    busy: false,
    steamRunning: false,
    canRestartSteam: false,
    ...rest,
    millennium: {
      supported: true,
      unsupportedReason: null,
      installed: null,
      update: null,
      pending: null,
      downloadSize: null,
      ...millennium,
    },
  };
}

export function deckyState(
  plugin: Partial<DeckyState['plugin']> = {},
  installed = true
): DeckyState {
  return {
    installed,
    running: installed,
    plugin: {
      installed: true,
      version: '1.1.0',
      disabled: false,
      connected: false,
      outdated: false,
      ...plugin,
    },
  };
}

interface BridgeStatusOverrides extends Partial<Omit<SteamBridgeStatus, 'millennium'>> {
  connected?: boolean;
  updateAfterRestart?: boolean;
}

export function steamBridgeStatus({
  connected = false,
  updateAfterRestart = false,
  ...overrides
}: BridgeStatusOverrides = {}): SteamBridgeStatus {
  return {
    code: 'ok',
    transport: 'cdp',
    millennium: {
      detected: connected,
      generation: connected ? 'v3' : null,
      blocksTcpCdp: false,
      plugin: {
        supported: true,
        installed: connected,
        enabled: connected,
        connected,
        updateAfterRestart,
      },
    },
    steamElevated: false,
    gamescope: false,
    canRestartSteam: true,
    pendingLaunchOptions: [],
    pluginHost: 'millennium',
    decky: null,
    achievements: { state: 'needs-millennium', unsupportedReason: null },
    ...overrides,
  };
}
