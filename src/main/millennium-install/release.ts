export type MillenniumOs = 'windows' | 'linux' | 'macos';
export type MacHardwareArch = 'arm64' | 'x86_64';

export interface MillenniumAsset {
  url: string;
  sha256: string;
  size: number;
  kind: 'zip' | 'tar.gz';
}

interface PinnedRelease<Assets> {
  tag: string;
  version: string;
  assets: Assets;
}

interface MillenniumPin {
  windows: PinnedRelease<MillenniumAsset> | null;
  linux: PinnedRelease<MillenniumAsset> | null;
  macos: PinnedRelease<Record<MacHardwareArch, MillenniumAsset>> | null;
}

export interface SelectedMillenniumRelease {
  tag: string;
  version: string;
  asset: MillenniumAsset;
}

const UPSTREAM = 'https://github.com/SteamClientHomebrew/Millennium/releases/download';
const FORK = 'https://github.com/Vadko/Millennium/releases/download';

// Pinned into the signed LBK binary: the sha256 here is the only reason the archive is trusted.
export const MILLENNIUM_PIN: MillenniumPin = {
  windows: {
    tag: 'v3.5.0',
    version: '3.5.0',
    assets: {
      url: `${UPSTREAM}/v3.5.0/millennium-v3.5.0-windows-x86_64.zip`,
      sha256: '66ed3d35076c64effe519944d100b64ec7cfd76082e88b4d342da9e493142448',
      size: 3994245,
      kind: 'zip',
    },
  },
  linux: {
    tag: 'v3.5.0',
    version: '3.5.0',
    assets: {
      url: `${UPSTREAM}/v3.5.0/millennium-v3.5.0-linux-x86_64.tar.gz`,
      sha256: 'fafe32380c9fdaadcee07bb539b4ed839b312d70a15bb97a29ddd66009b5ac28',
      size: 8784720,
      kind: 'tar.gz',
    },
  },
  macos: {
    tag: 'lbk-v3.5.0-beta.3-lbk.4',
    version: '3.5.0-beta.3-lbk.4',
    assets: {
      arm64: {
        url: `${FORK}/lbk-v3.5.0-beta.3-lbk.4/millennium-3.5.0-beta.3-lbk.4-darwin-arm64.tar.gz`,
        sha256: '9d7cd334366c691210330b63a7c4d615b028d5328de88d2f50689edc88e16d52',
        size: 5895304,
        kind: 'tar.gz',
      },
      x86_64: {
        url: `${FORK}/lbk-v3.5.0-beta.3-lbk.4/millennium-3.5.0-beta.3-lbk.4-darwin-x86_64.tar.gz`,
        sha256: '85a919cb733b5f26715bd808d75a9590e0b2110bf45cca8cc1c6cbade170a163',
        size: 5811648,
        kind: 'tar.gz',
      },
    },
  },
};

export function selectMillenniumAsset(
  pin: MillenniumPin,
  os: MillenniumOs,
  hwArch: MacHardwareArch | null
): SelectedMillenniumRelease | null {
  if (os === 'macos') {
    const mac = pin.macos;
    if (!mac || !hwArch) {
      return null;
    }
    return { tag: mac.tag, version: mac.version, asset: mac.assets[hwArch] };
  }
  const release = pin[os];
  return release
    ? { tag: release.tag, version: release.version, asset: release.assets }
    : null;
}

export function pinnedTagFor(pin: MillenniumPin, os: MillenniumOs): string | null {
  return pin[os]?.tag ?? null;
}
