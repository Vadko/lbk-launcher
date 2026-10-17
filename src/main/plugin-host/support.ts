import * as path from 'node:path';
import type {
  AchievementsBadge,
  AchievementsDelivery,
  MillenniumUnsupportedReason,
  PluginHostState,
} from '@/shared/types';

export interface HostFacts {
  os: 'windows' | 'linux' | 'macos' | 'unknown';
  arch: string;
  steamPath: string | null;
  millenniumGeneration: 'v2' | 'v3' | null;
  // A pinned release exists for this OS/hardware and the per-OS release switch is on.
  releaseAvailable: boolean;
  macos: null | { darwin: [number, number] };
  linux: null | {
    steamType: 'native' | 'flatpak' | 'snap' | 'unknown';
    // SteamOS or Steam Deck hardware running another distro.
    steamOS: boolean;
    // A distro package (AUR and the like) in /usr/lib/millennium, linked or not.
    systemMillennium: boolean;
    deckyInstalled: boolean;
    nixos: boolean;
    homeLinkOk: boolean;
    rt64: boolean;
    libssl32: boolean;
  };
}

// The Steam LBK actually found decides; a ~/.var/app leftover from an uninstalled Flatpak does not.
export function steamTypeFromPath(
  steamPath: string,
  home: string
): NonNullable<HostFacts['linux']>['steamType'] {
  const rel = path.posix.relative(home, steamPath);
  if (rel.startsWith('.var/app/com.valvesoftware.Steam/')) {
    return 'flatpak';
  }
  if (rel.startsWith('snap/steam/')) {
    return 'snap';
  }
  return 'native';
}

export interface MillenniumSupport {
  supported: boolean;
  reason: MillenniumUnsupportedReason | null;
}

const unsupported = (reason: MillenniumUnsupportedReason): MillenniumSupport => ({
  supported: false,
  reason,
});

// Whether LBK itself may install Millennium here; an existing install is judged separately.
export function evaluateMillenniumSupport(f: HostFacts): MillenniumSupport {
  if (f.os === 'unknown') {
    return unsupported('no-steam');
  }
  if (f.os === 'linux' && f.linux) {
    if (f.arch !== 'x64') {
      return unsupported('arch');
    }
    if (f.linux.steamType === 'flatpak') {
      return unsupported('flatpak-steam');
    }
    if (f.linux.steamType === 'snap') {
      return unsupported('snap-steam');
    }
    if (f.linux.steamOS) {
      return unsupported('steamos');
    }
    if (f.linux.deckyInstalled) {
      return unsupported('decky-present');
    }
  }
  if (!f.steamPath) {
    return unsupported('no-steam');
  }
  if (f.os === 'windows' && f.millenniumGeneration === 'v2') {
    return unsupported('millennium-v2');
  }
  if (f.os === 'macos' && f.macos) {
    const [major, minor] = f.macos.darwin;
    if (major < 22 || (major === 22 && minor < 4)) {
      return unsupported('macos-too-old');
    }
  }
  if (f.os === 'linux' && f.linux) {
    if (f.linux.nixos && f.millenniumGeneration === null) {
      return unsupported('nixos');
    }
    if (!f.linux.homeLinkOk) {
      return unsupported('steam-home-link');
    }
    if (f.linux.rt64) {
      return unsupported('steam-rt64');
    }
    if (!f.linux.libssl32) {
      return unsupported('missing-libssl32');
    }
  }
  if (!f.releaseAvailable) {
    return unsupported('no-release');
  }
  return { supported: true, reason: null };
}

// Dev-only LBK_PLUGIN_HOST=millennium tests the Linux Millennium path on a Deck: it drops just the SteamOS rule.
export function withPluginHostOverride(
  f: HostFacts,
  override: string | undefined
): HostFacts {
  if (override !== 'millennium' || !f.linux) {
    return f;
  }
  return { ...f, linux: { ...f.linux, steamOS: false } };
}

// Decky wins on any Linux where it is present: Millennium deletes the flag file Decky depends on.
export function pickPluginHost(
  f: HostFacts,
  support: MillenniumSupport
): PluginHostState['host'] {
  if (f.os === 'linux' && f.linux && (f.linux.deckyInstalled || f.linux.steamOS)) {
    return 'decky';
  }
  if (f.millenniumGeneration === 'v3' || support.supported) {
    return 'millennium';
  }
  return 'none';
}

// Decky ships its installer as a Desktop Mode tool: the sudo password prompt is a zenity dialog.
// Installed but not running (a failed install leaves the unit without the binary) keeps the offer as a repair.
export function deckyLoaderOffer(f: {
  host: PluginHostState['host'];
  deckyInstalled: boolean;
  deckyRunning: boolean;
  gamescope: boolean;
  installing: boolean;
}): PluginHostState['deckyLoader'] {
  if (f.host !== 'decky' || (f.deckyInstalled && f.deckyRunning && !f.installing)) {
    return null;
  }
  return {
    installing: f.installing,
    blockedBy: f.gamescope ? 'game-mode' : null,
    repair: f.deckyInstalled && !f.deckyRunning,
  };
}

export interface AchievementsFacts {
  os: HostFacts['os'];
  settingOn: boolean;
  host: PluginHostState['host'];
  steamRunning: boolean;
  // The host of the LBK Bridge copy that is connected, whatever host LBK would pick.
  connectedHost: 'millennium' | 'decky' | null;
  millennium: {
    v3: boolean;
    pluginInstalled: boolean;
    pluginEnabled: boolean;
    activationPending: boolean;
  };
  support: MillenniumSupport;
  decky: null | {
    installed: boolean;
    running: boolean;
    pluginInstalled: boolean;
    pluginDisabled: boolean;
  };
}

// The one place that decides whether achievement strings reach Steam; delivery and the install badge derive from it.
export function computeAchievementsBadge(f: AchievementsFacts): AchievementsBadge {
  const badge = (state: AchievementsBadge['state']): AchievementsBadge => ({
    state,
    unsupportedReason: f.support.reason,
  });
  if (!f.settingOn) {
    return badge('setting-off');
  }
  // A Linux PC with both Decky and Millennium delivers through Millennium's copy: that is what counts.
  if (f.connectedHost) {
    return badge(f.connectedHost);
  }
  if (f.host === 'decky') {
    if (!f.decky?.installed || !f.decky.running) {
      return badge('needs-decky');
    }
    if (!f.decky.pluginInstalled || f.decky.pluginDisabled) {
      return badge('needs-decky-plugin');
    }
    return badge(f.steamRunning ? 'after-restart' : 'decky');
  }
  if (f.millennium.v3) {
    const ready = f.millennium.pluginInstalled && f.millennium.pluginEnabled;
    return badge(ready && !f.steamRunning ? 'millennium' : 'after-restart');
  }
  if (f.millennium.activationPending) {
    return badge('after-restart');
  }
  // Before LBK ships a pin for this OS a manually installed Millennium still works; the macOS build is LBK's fork only.
  const manualInstallWorks = f.support.reason === 'no-release' && f.os !== 'macos';
  if (f.support.supported || manualInstallWorks) {
    return badge('needs-millennium');
  }
  return badge('unsupported');
}

export function deliveryFromBadge(
  badge: AchievementsBadge,
  reloaded: boolean
): AchievementsDelivery {
  if (badge.state === 'setting-off') {
    return 'disabled';
  }
  if (reloaded) {
    return 'plugin-live';
  }
  switch (badge.state) {
    case 'millennium':
    case 'decky':
    case 'after-restart':
      return 'plugin-next-start';
    case 'needs-millennium':
    case 'needs-decky-plugin':
    case 'needs-decky':
      return badge.state;
    default:
      return 'unavailable';
  }
}
