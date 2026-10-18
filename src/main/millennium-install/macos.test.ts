import { describe, expect, it, vi } from 'vitest';
import {
  MAC_RUNTIME_ITEMS,
  parseHwArm64,
  planMacWrapperLayout,
  verifyMacManifest,
} from './macos';

vi.mock('@/main/game-detector/steam', () => ({ getSteamPath: () => null }));

const HASH = 'a'.repeat(64);

function manifest(extra: Record<string, unknown> = {}) {
  const files: Record<string, string> = { 'app/Info.plist.xml': HASH };
  for (const item of MAC_RUNTIME_ITEMS) {
    files[`runtime/${item}`] = HASH;
  }
  return { version: '3.5.0-beta.3-lbk.4', arch: 'arm64', files, ...extra };
}

describe('parseHwArm64', () => {
  it('reads sysctl hw.optional.arm64', () => {
    expect(parseHwArm64('1\n')).toBe(true);
    expect(parseHwArm64('0\n')).toBe(false);
    expect(parseHwArm64('')).toBe(false);
  });
});

describe('verifyMacManifest', () => {
  it('accepts a bundle whose files all match', () => {
    expect(verifyMacManifest(manifest(), 'arm64', '/s', () => HASH)).toEqual({
      ok: true,
      version: '3.5.0-beta.3-lbk.4',
    });
  });

  it('rejects another arch, a hash mismatch, a missing file or an unsafe path', () => {
    expect(verifyMacManifest(manifest(), 'x86_64', '/s', () => HASH).ok).toBe(false);
    expect(
      verifyMacManifest(manifest(), 'arm64', '/s', (file) =>
        file === '/s/runtime/steam_osx' ? 'b'.repeat(64) : HASH
      ).ok
    ).toBe(false);
    expect(verifyMacManifest(manifest(), 'arm64', '/s', () => null).ok).toBe(false);
    const evil = manifest();
    evil.files['../../etc/x'] = HASH;
    expect(verifyMacManifest(evil, 'arm64', '/s', () => HASH).ok).toBe(false);
    expect(verifyMacManifest({ arch: 'arm64' }, 'arm64', '/s', () => HASH).ok).toBe(
      false
    );
  });
});

describe('planMacWrapperLayout', () => {
  it('copies Info.plist and the icon, and symlinks the runtime through current', () => {
    const layout = planMacWrapperLayout({
      bundleRoot: '/s',
      runtimeCurrent: '/r/current',
      appBundle: '/a/Steam Millennium.app',
    });
    expect(layout.copies).toEqual([
      {
        from: '/s/app/Info.plist.xml',
        to: '/a/Steam Millennium.app/Contents/Info.plist',
      },
      {
        from: '/s/app/AppIcon.icns',
        to: '/a/Steam Millennium.app/Contents/Resources/AppIcon.icns',
      },
    ]);
    expect(layout.links).toContainEqual({
      target: '/r/current/steam_osx',
      link: '/a/Steam Millennium.app/Contents/MacOS/steam_osx',
    });
    expect(layout.links).toContainEqual({
      target: '/r/current/millennium-assets',
      link: '/a/Steam Millennium.app/Contents/Resources/millennium-assets',
    });
    expect(layout.links).toHaveLength(MAC_RUNTIME_ITEMS.length + 1);
  });
});
