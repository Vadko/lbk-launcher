import { F } from '@mobily/ts-belt';
import { getPlatform, readOsRelease } from '@/main/utils/platform';

const MAX_LENGTH = 120;
const FIRST_WINDOWS_11_BUILD = 22000;

type Platform = ReturnType<typeof getPlatform>;
type OsRelease = NodeJS.Dict<string>;

function withVersion(name: string, version: string): string {
  return version ? `${name} (${version})` : name;
}

function windowsName(version: string): string {
  const build = Number.parseInt(version.split('.')[2] ?? '', 10);
  return build >= FIRST_WINDOWS_11_BUILD ? 'Windows 11' : 'Windows 10';
}

const describeOs: Record<
  Platform,
  (version: string, osRelease: OsRelease) => string | undefined
> = {
  windows: (version) => withVersion(windowsName(version), version),
  macos: (version) => `macOS ${version}`.trim(),
  linux: (version, osRelease) =>
    withVersion(osRelease.PRETTY_NAME?.trim() || 'Linux', version),
  unknown: () => undefined,
};

export function formatOsVersion(
  platform: Platform,
  systemVersion: string,
  osRelease: OsRelease = {}
): string | undefined {
  const description = describeOs[platform](systemVersion.trim(), osRelease);
  // Code points, as Postgres char_length counts them.
  return description && Array.from(description).slice(0, MAX_LENGTH).join('');
}

export const getOsVersion = F.once((): string | undefined => {
  const platform = getPlatform();
  return formatOsVersion(
    platform,
    process.getSystemVersion(),
    platform === 'linux' ? readOsRelease() : {}
  );
});
