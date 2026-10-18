export type AchievementsDelivery =
  | 'plugin-live'
  | 'plugin-next-start'
  | 'needs-millennium'
  | 'needs-decky-plugin'
  | 'needs-decky'
  | 'unavailable'
  | 'disabled';

export type MillenniumUnsupportedReason =
  | 'no-steam'
  | 'arch'
  | 'flatpak-steam'
  | 'snap-steam'
  | 'steam-rt64'
  | 'missing-libssl32'
  | 'steam-home-link'
  | 'nixos'
  | 'steamos'
  | 'decky-present'
  | 'macos-too-old'
  | 'no-release'
  | 'millennium-v2';

type AchievementsBadgeState =
  | 'millennium'
  | 'decky'
  | 'after-restart'
  | 'needs-millennium'
  | 'needs-decky-plugin'
  | 'needs-decky'
  | 'unsupported'
  | 'setting-off';

// Whether installed achievement strings will show up in Steam on this machine.
export interface AchievementsBadge {
  state: AchievementsBadgeState;
  // Set for 'unsupported' (and 'needs-*' when known) so the renderer can explain why.
  unsupportedReason: MillenniumUnsupportedReason | null;
}

export interface PluginHostState {
  host: 'millennium' | 'decky' | 'none';
  millennium: {
    supported: boolean;
    unsupportedReason: MillenniumUnsupportedReason | null;
    installed: null | {
      managedBy: 'lbk' | 'external';
      version: string | null;
      mode: 'windows' | 'linux-user' | 'macos-wrapper' | null;
      needsRepair: boolean;
    };
    update: null | { version: string };
    pending: 'activate' | 'deactivate' | null;
    downloadSize: number | null;
  };
  decky: null | {
    installed: boolean;
    running: boolean;
    plugin: {
      installed: boolean;
      version: string | null;
      disabled: boolean;
      connected: boolean;
      outdated: boolean;
    };
  };
  // Set only where Decky is the host and missing: LBK can launch Decky's own installer.
  deckyLoader: null | {
    installing: boolean;
    blockedBy: 'game-mode' | null;
    // Installed but its service is not running.
    repair: boolean;
  };
  busy: boolean;
  steamRunning: boolean;
  canRestartSteam: boolean;
}

type MillenniumPhase =
  | 'download'
  | 'verify'
  | 'extract'
  | 'stop-steam'
  | 'install-files'
  | 'start-steam'
  | 'wait-plugin';

export interface MillenniumProgress {
  phase: MillenniumPhase;
  percent?: number;
}

export type MillenniumFailure =
  | 'unsupported'
  | 'busy'
  | 'cancelled'
  | 'download-failed'
  | 'checksum-mismatch'
  | 'extract-failed'
  | 'av-blocked'
  | 'not-writable'
  | 'conflict'
  | 'not-prepared'
  | 'script-failed'
  | 'files-locked'
  | 'restart-failed'
  | 'plugin-not-connected';

export interface MillenniumInstallResult {
  success: boolean;
  // The change waits in the pending-actions queue for Steam's next exit.
  queued?: boolean;
  // prepare: files are staged and activation may be requested.
  ready?: boolean;
  // prepare: Steam was up; activate: Steam is up after the change (false: applied while it was closed).
  steamRunning?: boolean;
  canRestartSteam?: boolean;
  reason?: MillenniumFailure;
  restartReason?: RestartFailureReason;
  bridge?: 'ready' | 'blocked' | 'unknown';
  diagnostics?: {
    filesPresent?: boolean;
    mappedInSteam?: boolean;
    steamEnvMissing?: boolean;
  };
  error?: string;
}

export type DeckyInstallResult =
  | { success: true; state: 'prompted' | 'installed' }
  | {
      success: false;
      reason:
        | 'no-decky'
        | 'decky-not-running'
        | 'bridge-unavailable'
        | 'timeout'
        | 'failed';
      error?: string;
    };

export type DeckyLoaderInstallResult =
  | { success: true }
  | {
      success: false;
      reason:
        | 'unsupported'
        | 'game-mode'
        | 'download-failed'
        | 'checksum-mismatch'
        | 'not-installed'
        | 'not-running';
      error?: string;
    };

export type SteamBridgeStatusCode =
  | 'ok'
  | 'setting-off'
  | 'steam-not-running'
  | 'restart-pending'
  | 'cef-blocked'
  | 'millennium-plugin-pending'
  | 'millennium-outdated';

export interface SteamBridgeStatus {
  code: SteamBridgeStatusCode;
  transport: 'cdp' | 'plugin' | null;
  millennium: {
    detected: boolean;
    generation: 'v2' | 'v3' | null;
    blocksTcpCdp: boolean;
    plugin: {
      // False when the plugins dir or config is missing or invalid.
      supported: boolean;
      installed: boolean;
      enabled: boolean;
      connected: boolean;
    };
  };
  steamElevated: boolean;
  gamescope: boolean;
  // Steam running, not elevated, not under gamescope.
  canRestartSteam: boolean;
  pendingLaunchOptions: { gameId: string; gameName: string }[];
  pluginHost: PluginHostState['host'];
  decky: PluginHostState['decky'];
  achievements: AchievementsBadge;
}

export type RestartFailureReason =
  | 'access-denied'
  | 'gamescope'
  | 'game-running'
  | 'timeout'
  | 'launch-failed';

export interface RestartSteamResult {
  success: boolean;
  reason?: RestartFailureReason;
  bridge?: 'ready' | 'blocked' | 'unknown';
  error?: string;
}

export interface ApplyPendingLaunchOptionsResult {
  success: boolean;
  reason?: RestartFailureReason;
  // The item stays queued for the next Steam exit.
  queued?: boolean;
  error?: string;
}
