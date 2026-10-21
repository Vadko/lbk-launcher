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
    tag: 'lbk-v3.5.0-beta.3-lbk.5',
    version: '3.5.0-beta.3-lbk.5',
    assets: {
      arm64: {
        url: `${FORK}/lbk-v3.5.0-beta.3-lbk.5/millennium-3.5.0-beta.3-lbk.5-darwin-arm64.tar.gz`,
        sha256: '2c7a4567fc01fd46e61b7eee8e51dd00a8851a754d8989b509397f204ce58bb8',
        size: 5896431,
        kind: 'tar.gz',
      },
      x86_64: {
        url: `${FORK}/lbk-v3.5.0-beta.3-lbk.5/millennium-3.5.0-beta.3-lbk.5-darwin-x86_64.tar.gz`,
        sha256: 'f721fba265e33db863814edf997802fc04c6601c6f4fea1dc7c4050a5c555cd0',
        size: 5809115,
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
