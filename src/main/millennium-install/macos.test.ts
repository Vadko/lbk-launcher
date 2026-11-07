import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  MAC_RUNTIME_ITEMS,
  macDriver,
  parseHwArm64,
  planMacWrapperLayout,
  verifyMacManifest,
} from './macos';
import { millenniumInstallPaths } from './paths';

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

describe.skipIf(process.platform === 'win32')('macDriver.remove', () => {
  let dir: string | null = null;

  afterEach(() => {
    if (dir) {
      fs.rmSync(dir, { recursive: true, force: true });
      dir = null;
    }
  });

  it("deletes only the wrapper in this user's Applications, whatever the record names", () => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lbk-mac-remove-'));
    const home = path.posix.join(dir, 'home');
    const elsewhere = path.posix.join(dir, 'Volumes/X/Applications/Steam Millennium.app');
    const paths = millenniumInstallPaths({
      os: 'macos',
      home,
      steamPath: path.posix.join(home, 'Library/Application Support/Steam'),
      env: {},
      insideFlatpak: false,
    });
    const own = paths.macos?.appBundle ?? '';
    for (const app of [own, elsewhere]) {
      fs.mkdirSync(path.posix.join(app, 'Contents/MacOS'), { recursive: true });
    }

    macDriver.remove(
      {
        steamPath: path.posix.join(home, 'Library/Application Support/Steam'),
        paths,
        record: {
          format: 1,
          os: 'macos',
          mode: 'macos-wrapper',
          tag: 'lbk.5',
          version: '3.5.0',
          activatedAt: '2026-10-15T00:00:00.000Z',
          steamPath: path.posix.join(home, 'Library/Application Support/Steam'),
          xtstBackups: [],
          appBundle: elsewhere,
        },
      },
      false
    );

    expect(fs.existsSync(own)).toBe(false);
    expect(fs.existsSync(elsewhere)).toBe(true);
  });
});
