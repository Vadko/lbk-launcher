import { describe, expect, it } from 'vitest';
import {
  MILLENNIUM_INSTALL_ENABLED,
  MILLENNIUM_PIN,
  type MillenniumAsset,
  pinnedTagFor,
  selectMillenniumAsset,
} from './release';

const ALL_ON = { windows: true, linux: true, macos: true };

function assets(): MillenniumAsset[] {
  const out: MillenniumAsset[] = [];
  if (MILLENNIUM_PIN.windows) {
    out.push(MILLENNIUM_PIN.windows.assets);
  }
  if (MILLENNIUM_PIN.linux) {
    out.push(MILLENNIUM_PIN.linux.assets);
  }
  if (MILLENNIUM_PIN.macos) {
    out.push(MILLENNIUM_PIN.macos.assets.arm64, MILLENNIUM_PIN.macos.assets.x86_64);
  }
  return out;
}

describe('MILLENNIUM_PIN', () => {
  it('pins every asset by sha256 and size to a direct release download', () => {
    expect(assets()).toHaveLength(4);
    for (const asset of assets()) {
      expect(asset.sha256).toMatch(/^[0-9a-f]{64}$/);
      expect(asset.size).toBeGreaterThan(0);
      expect(asset.url).toMatch(
        /^https:\/\/github\.com\/[^/]+\/Millennium\/releases\/download\//
      );
      expect(asset.url).not.toContain('api.github.com');
      expect(asset.url.endsWith(asset.kind === 'zip' ? '.zip' : '.tar.gz')).toBe(true);
    }
  });

  it('puts the tag into each asset URL', () => {
    for (const os of ['windows', 'linux', 'macos'] as const) {
      const tag = pinnedTagFor(MILLENNIUM_PIN, os);
      const selected = selectMillenniumAsset(MILLENNIUM_PIN, os, 'arm64', ALL_ON);
      expect(tag).not.toBeNull();
      expect(selected?.asset.url).toContain(`/download/${tag}/`);
    }
  });

  it('takes the macOS fork from the notarized lbk.4 build', () => {
    expect(MILLENNIUM_PIN.macos?.tag).toBe('lbk-v3.5.0-beta.3-lbk.4');
    expect(MILLENNIUM_PIN.macos?.assets.arm64.url).toContain('Vadko/Millennium');
  });
});

describe('selectMillenniumAsset', () => {
  it('picks the macOS asset by hardware arch, not process arch', () => {
    expect(
      selectMillenniumAsset(MILLENNIUM_PIN, 'macos', 'arm64', ALL_ON)?.asset.url
    ).toMatch(/darwin-arm64\.tar\.gz$/);
    expect(
      selectMillenniumAsset(MILLENNIUM_PIN, 'macos', 'x86_64', ALL_ON)?.asset.url
    ).toMatch(/darwin-x86_64\.tar\.gz$/);
    expect(selectMillenniumAsset(MILLENNIUM_PIN, 'macos', null, ALL_ON)).toBeNull();
  });

  it('returns nothing for a platform whose release switch is off', () => {
    const off = { windows: false, linux: true, macos: true };
    expect(selectMillenniumAsset(MILLENNIUM_PIN, 'windows', null, off)).toBeNull();
    expect(selectMillenniumAsset(MILLENNIUM_PIN, 'linux', null, off)?.tag).toBe('v3.5.0');
  });

  it('returns nothing for a platform without a pin', () => {
    const pin = { ...MILLENNIUM_PIN, linux: null };
    expect(selectMillenniumAsset(pin, 'linux', null, ALL_ON)).toBeNull();
    expect(pinnedTagFor(pin, 'linux')).toBeNull();
  });

  it('ships only the platforms whose live test passed', () => {
    expect(MILLENNIUM_INSTALL_ENABLED).toEqual({
      windows: false,
      linux: false,
      macos: true,
    });
  });
});
