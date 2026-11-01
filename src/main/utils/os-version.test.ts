import { parseEnv } from 'util';
import { describe, expect, it } from 'vitest';
import { formatOsVersion } from '@/main/utils/os-version';

const STEAMOS_RELEASE = parseEnv(
  'NAME="SteamOS"\nPRETTY_NAME="SteamOS"\nID=steamos\nID_LIKE=arch\nVERSION_ID=3.6.19\n'
);
const UBUNTU_RELEASE = parseEnv(
  'PRETTY_NAME="Ubuntu 24.04.1 LTS"\nNAME="Ubuntu"\nVERSION_ID="24.04"\nID=ubuntu\n'
);

describe('formatOsVersion', () => {
  it.each([
    ['Windows 11', 'windows', '10.0.22631', {}, 'Windows 11 (10.0.22631)'],
    [
      'the first Windows 11 build',
      'windows',
      '10.0.22000',
      {},
      'Windows 11 (10.0.22000)',
    ],
    ['Windows 10', 'windows', '10.0.19045', {}, 'Windows 10 (10.0.19045)'],
    ['macOS', 'macos', '26.0.1', {}, 'macOS 26.0.1'],
    [
      'SteamOS',
      'linux',
      '6.5.0-valve22-1-neptune-65',
      STEAMOS_RELEASE,
      'SteamOS (6.5.0-valve22-1-neptune-65)',
    ],
    [
      'Ubuntu',
      'linux',
      '6.8.0-45-generic',
      UBUNTU_RELEASE,
      'Ubuntu 24.04.1 LTS (6.8.0-45-generic)',
    ],
    ['Linux without os-release', 'linux', '6.8.0', {}, 'Linux (6.8.0)'],
    ['a blank PRETTY_NAME', 'linux', '6.8.0', { PRETTY_NAME: '  ' }, 'Linux (6.8.0)'],
    ['an empty system version', 'linux', '', STEAMOS_RELEASE, 'SteamOS'],
    ['an unshipped OS', 'unknown', '14.1', {}, undefined],
  ] as const)('%s', (_label, platform, version, osRelease, expected) => {
    expect(formatOsVersion(platform, version, osRelease)).toBe(expected);
  });
});
