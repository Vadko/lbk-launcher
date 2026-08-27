import { release } from 'os';

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
