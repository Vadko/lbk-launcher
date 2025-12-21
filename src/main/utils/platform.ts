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

export function getPlatform(): 'macos' | 'windows' | 'linux' | 'unknown' {
  if (isMacOS()) return 'macos';
  if (isWindows()) return 'windows';
  if (isLinux()) return 'linux';
  return 'unknown';
}

function getMacOSVersion(): number {
  if (!isMacOS()) return 0;

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
  if (!isMacOS()) return false;

  const macOSVersion = getMacOSVersion();
  // macOS 26 (Darwin 25.x) or later supports liquid glass
  return macOSVersion >= 25;
}

export function shouldEnableLiquidGlass(userPreference = true): boolean {
  return supportsMacOSLiquidGlass() && userPreference;
}
