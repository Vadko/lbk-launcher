import { describe, expect, it } from 'vitest';
import {
  MILLENNIUM_PIN,
  type MillenniumAsset,
  pinnedTagFor,
  selectMillenniumAsset,
} from './release';

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

  it.each(['windows', 'linux', 'macos'] as const)(
    'puts the tag into the %s asset URL',
    (os) => {
      const tag = pinnedTagFor(MILLENNIUM_PIN, os);
      const selected = selectMillenniumAsset(MILLENNIUM_PIN, os, 'arm64');
      expect(tag).not.toBeNull();
      expect(selected?.asset.url).toContain(`/download/${tag}/`);
    }
  );
});

describe('selectMillenniumAsset', () => {
  it('picks the macOS asset by hardware arch, not process arch', () => {
    expect(selectMillenniumAsset(MILLENNIUM_PIN, 'macos', 'arm64')?.asset.url).toMatch(
      /darwin-arm64\.tar\.gz$/
    );
    expect(selectMillenniumAsset(MILLENNIUM_PIN, 'macos', 'x86_64')?.asset.url).toMatch(
      /darwin-x86_64\.tar\.gz$/
    );
    expect(selectMillenniumAsset(MILLENNIUM_PIN, 'macos', null)).toBeNull();
  });

  it('returns nothing for a platform without a pin', () => {
    const pin = { ...MILLENNIUM_PIN, linux: null };
    expect(selectMillenniumAsset(pin, 'linux', null)).toBeNull();
    expect(pinnedTagFor(pin, 'linux')).toBeNull();
  });
});
