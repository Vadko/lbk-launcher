import { hash } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { G } from '@mobily/ts-belt';
import { replaceSymlinkAtomic } from '@/main/utils/atomic-write';
import { isSafeArchiveEntry } from './extract';
import type { MacHardwareArch } from './release';

export const MAC_RUNTIME_ITEMS = [
  'steam_osx',
  'libmillennium_bootstrap.dylib',
  'libmillennium.dylib',
  'libmillennium_hhx64.dylib',
  'libmillennium_child_hook.dylib',
  'libmillennium_luavm_x86',
] as const;
const MAC_ASSETS_DIR = 'millennium-assets';
const MANIFEST = 'manifest.json';

export function parseHwArm64(sysctlOutput: string): boolean {
  return sysctlOutput.trim() === '1';
}

export function verifyMacManifest(
  manifest: unknown,
  arch: MacHardwareArch,
  hashOf: (rel: string) => string | null
): { ok: true; version: string } | { ok: false; error: string } {
  if (!G.isObject(manifest) || !G.isObject(manifest.files)) {
    return { ok: false, error: 'manifest has no files' };
  }
  if (manifest.arch !== arch) {
    return { ok: false, error: `manifest arch ${String(manifest.arch)} != ${arch}` };
  }
  if (typeof manifest.version !== 'string' || !/^[\w.-]+$/.test(manifest.version)) {
    return { ok: false, error: 'manifest has no usable version' };
  }
  const files = manifest.files;
  for (const item of MAC_RUNTIME_ITEMS) {
    if (!(`runtime/${item}` in files)) {
      return { ok: false, error: `manifest lacks runtime/${item}` };
    }
  }
  for (const [rel, expected] of Object.entries(files)) {
    if (!isSafeArchiveEntry(rel) || typeof expected !== 'string') {
      return { ok: false, error: `bad manifest entry ${rel}` };
    }
    const actual = hashOf(rel);
    if (actual !== expected.toLowerCase()) {
      return { ok: false, error: `${rel}: ${actual ?? 'missing'}` };
    }
  }
  return { ok: true, version: manifest.version };
}

export interface MacWrapperLayout {
  copies: { from: string; to: string }[];
  links: { target: string; link: string }[];
}

// Same layout as the fork's install_macos.sh wrapper-app flow: real files in the runtime, symlinks in the app.
export function planMacWrapperLayout(i: {
  bundleRoot: string;
  runtimeCurrent: string;
  appBundle: string;
}): MacWrapperLayout {
  const contents = path.posix.join(i.appBundle, 'Contents');
  return {
    copies: [
      {
        from: path.posix.join(i.bundleRoot, 'app/Info.plist.xml'),
        to: path.posix.join(contents, 'Info.plist'),
      },
      {
        from: path.posix.join(i.bundleRoot, 'app/AppIcon.icns'),
        to: path.posix.join(contents, 'Resources/AppIcon.icns'),
      },
    ],
    links: [
      ...MAC_RUNTIME_ITEMS.map((item) => ({
        target: path.posix.join(i.runtimeCurrent, item),
        link: path.posix.join(contents, 'MacOS', item),
      })),
      {
        target: path.posix.join(i.runtimeCurrent, MAC_ASSETS_DIR),
        link: path.posix.join(contents, 'Resources', MAC_ASSETS_DIR),
      },
    ],
  };
}

export function findMacBundleRoot(stagingDir: string): string | null {
  if (fs.existsSync(path.posix.join(stagingDir, MANIFEST))) {
    return stagingDir;
  }
  for (const entry of fs.readdirSync(stagingDir, { withFileTypes: true })) {
    const candidate = path.posix.join(stagingDir, entry.name);
    if (entry.isDirectory() && fs.existsSync(path.posix.join(candidate, MANIFEST))) {
      return candidate;
    }
  }
  return null;
}

function hashFileSync(file: string): string | null {
  try {
    return hash('sha256', fs.readFileSync(file));
  } catch {
    return null;
  }
}

export function verifyMacBundle(
  bundleRoot: string,
  arch: MacHardwareArch
): ReturnType<typeof verifyMacManifest> {
  let manifest: unknown;
  try {
    manifest = JSON.parse(fs.readFileSync(path.posix.join(bundleRoot, MANIFEST), 'utf8'));
  } catch (error) {
    return { ok: false, error: `manifest unreadable: ${String(error)}` };
  }
  return verifyMacManifest(manifest, arch, (rel) =>
    hashFileSync(path.posix.join(bundleRoot, rel))
  );
}

// Steam must be off: replacing the runtime under a running wrapper crashes it.
export function applyMacActivation(i: {
  bundleRoot: string;
  version: string;
  runtimeRoot: string;
  runtimeCurrent: string;
  appBundle: string;
}): string {
  const runtimeDir = path.posix.join(i.runtimeRoot, i.version);
  const tmpRuntime = `${runtimeDir}.lbk-new`;
  fs.rmSync(tmpRuntime, { recursive: true, force: true });
  fs.mkdirSync(i.runtimeRoot, { recursive: true });
  fs.cpSync(path.posix.join(i.bundleRoot, 'runtime'), tmpRuntime, {
    recursive: true,
    verbatimSymlinks: true,
  });
  fs.rmSync(runtimeDir, { recursive: true, force: true });
  fs.renameSync(tmpRuntime, runtimeDir);
  replaceSymlinkAtomic(runtimeDir, i.runtimeCurrent);

  const tmpApp = `${i.appBundle}.lbk-new`;
  fs.rmSync(tmpApp, { recursive: true, force: true });
  const layout = planMacWrapperLayout({
    bundleRoot: i.bundleRoot,
    runtimeCurrent: i.runtimeCurrent,
    appBundle: tmpApp,
  });
  for (const copy of layout.copies) {
    fs.mkdirSync(path.posix.dirname(copy.to), { recursive: true });
    fs.copyFileSync(copy.from, copy.to);
  }
  for (const link of layout.links) {
    fs.mkdirSync(path.posix.dirname(link.link), { recursive: true });
    fs.symlinkSync(link.target, link.link);
  }
  fs.rmSync(i.appBundle, { recursive: true, force: true });
  fs.renameSync(tmpApp, i.appBundle);

  for (const entry of fs.readdirSync(i.runtimeRoot)) {
    if (entry !== 'current' && entry !== i.version) {
      fs.rmSync(path.posix.join(i.runtimeRoot, entry), { recursive: true, force: true });
    }
  }
  return runtimeDir;
}

export function macWrapperIntact(appBundle: string, runtimeCurrent: string): boolean {
  return (
    fs.existsSync(path.posix.join(appBundle, 'Contents/MacOS/steam_osx')) &&
    fs.existsSync(path.posix.join(runtimeCurrent, 'steam_osx'))
  );
}
