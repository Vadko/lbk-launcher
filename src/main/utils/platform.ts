import { readFileSync } from 'fs';
import { release } from 'os';
import { parseEnv } from 'util';
import { isFlatpak } from './host-exec';

export function isMacOS(): boolean {
  return process.platform === 'darwin';
}

export function isWindows(): boolean {
  return process.platform === 'win32';
}

export function isLinux(): boolean {
  return process.platform === 'linux';
}

export function isPortable(): boolean {
  return isWindows() && !!process.env.PORTABLE_EXECUTABLE_FILE;
}

export function isGamescopeSession(): boolean {
  const env = process.env;
  return (
    Boolean(env.GAMESCOPE_WAYLAND_DISPLAY) ||
    env.XDG_CURRENT_DESKTOP === 'gamescope' ||
    env.XDG_SESSION_DESKTOP === 'gamescope'
  );
}

export function getPlatform(): 'macos' | 'windows' | 'linux' | 'unknown' {
  if (isMacOS()) {
    return 'macos';
  }
  if (isWindows()) {
    return 'windows';
  }
  if (isLinux()) {
    return 'linux';
  }
  return 'unknown';
}

type KnownPlatform = Exclude<ReturnType<typeof getPlatform>, 'unknown'>;

export function forCurrentOS<T>(
  branches: Partial<Record<KnownPlatform, T>> & { other: T }
): T;
export function forCurrentOS<T>(branches: Record<KnownPlatform, T>): T | null;
export function forCurrentOS<T>(
  branches: Partial<Record<KnownPlatform, T>> & { other?: T }
): T | null {
  const platform = getPlatform();

  // `in` rather than a truthiness or `??` check: a branch whose value is
  // legitimately null/undefined (launch options for an OS that has none, say)
  // must win over `other`, not fall through to it.
  if (platform !== 'unknown' && platform in branches) {
    return branches[platform] as T;
  }

  return 'other' in branches ? (branches.other as T) : null;
}

// Inside our Flatpak /etc/os-release describes the runtime, the host's copy is under /run/host.
function readOsRelease(): NodeJS.Dict<string> {
  const candidates = isFlatpak()
    ? ['/run/host/os-release', '/run/host/etc/os-release']
    : ['/etc/os-release', '/usr/lib/os-release'];
  for (const file of candidates) {
    try {
      return parseEnv(readFileSync(file, 'utf8'));
    } catch {
      // Try the next candidate.
    }
  }
  return {};
}

export function isSteamOS(): boolean {
  return isLinux() && readOsRelease().ID === 'steamos';
}

// Jupiter is the LCD Steam Deck, Galileo the OLED one.
export function isSteamDeckDmi(vendor: string, product: string): boolean {
  return vendor.trim() === 'Valve' && ['Jupiter', 'Galileo'].includes(product.trim());
}

// Bazzite, ChimeraOS and other Deck images do not say "steamos" in os-release.
export function isSteamDeckHardware(): boolean {
  if (!isLinux()) {
    return false;
  }
  try {
    const dmi = '/sys/devices/virtual/dmi/id';
    return isSteamDeckDmi(
      readFileSync(`${dmi}/board_vendor`, 'utf8'),
      readFileSync(`${dmi}/product_name`, 'utf8')
    );
  } catch {
    return false;
  }
}

export function parseDarwinRelease(value: string): [number, number] {
  const [major, minor] = value.split('.').map((part) => Number.parseInt(part, 10));
  return [Number.isFinite(major) ? major : 0, Number.isFinite(minor) ? minor : 0];
}

// Darwin kernel [major, minor]; [0, 0] off macOS.
export function getDarwinVersion(): [number, number] {
  return isMacOS() ? parseDarwinRelease(release()) : [0, 0];
}

function getMacOSVersion(): number {
  if (!isMacOS()) {
    return 0;
  }

  // Parse Darwin kernel version from os.release()
  // Darwin kernel version is typically one less than macOS marketing version:
  // Darwin 23.x = macOS 14 (Sonoma)
  // Darwin 24.x = macOS 15 (Sequoia)
  // Darwin 25.x = macOS 26 (Tahoe)
  const releaseVersion = release();
  const majorVersion = parseInt(releaseVersion.split('.')[0], 10);

  return majorVersion;
}

export function supportsMacOSLiquidGlass(): boolean {
  if (!isMacOS()) {
    return false;
  }

  const macOSVersion = getMacOSVersion();
  // macOS 26 (Darwin 25.x) or later supports liquid glass
  return macOSVersion >= 25;
}

export function shouldEnableLiquidGlass(userPreference = true): boolean {
  return supportsMacOSLiquidGlass() && userPreference;
}
