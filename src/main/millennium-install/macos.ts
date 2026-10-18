import * as fs from 'node:fs';
import * as path from 'node:path';
import { z } from 'zod';
import { replaceDirAtomic, replaceSymlinkAtomic } from '@/main/utils/atomic-write';
import { isPathInside, pruneDir } from '@/main/utils/fs-safe';
import { sha256FileSync } from '@/main/utils/hash';
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

const macManifestSchema = z.object({
  arch: z.string(),
  version: z.string().regex(/^[\w.-]+$/),
  files: z.record(z.string(), z.string()),
});

export function verifyMacManifest(
  raw: unknown,
  arch: MacHardwareArch,
  bundleRoot: string,
  hashOf: (file: string) => string | null
): { ok: true; version: string } | { ok: false; error: string } {
  const parsed = macManifestSchema.safeParse(raw);
  if (!parsed.success) {
    const fields = parsed.error.issues.map((issue) => issue.path.join('.') || 'root');
    return { ok: false, error: `bad manifest: ${fields.join(', ')}` };
  }
  const manifest = parsed.data;
  if (manifest.arch !== arch) {
    return { ok: false, error: `manifest arch ${manifest.arch} != ${arch}` };
  }
  const files = manifest.files;
  for (const item of MAC_RUNTIME_ITEMS) {
    if (!Object.hasOwn(files, `runtime/${item}`)) {
      return { ok: false, error: `manifest lacks runtime/${item}` };
    }
  }
  for (const [rel, expected] of Object.entries(files)) {
    const file = path.posix.join(bundleRoot, rel);
    if (!isPathInside(bundleRoot, file)) {
      return { ok: false, error: `bad manifest entry ${rel}` };
    }
    const actual = hashOf(file);
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
  return verifyMacManifest(manifest, arch, bundleRoot, sha256FileSync);
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
  replaceDirAtomic(runtimeDir, (tmp) =>
    fs.cpSync(path.posix.join(i.bundleRoot, 'runtime'), tmp, {
      recursive: true,
      verbatimSymlinks: true,
    })
  );
  replaceSymlinkAtomic(runtimeDir, i.runtimeCurrent);

  replaceDirAtomic(i.appBundle, (tmp) => {
    const layout = planMacWrapperLayout({
      bundleRoot: i.bundleRoot,
      runtimeCurrent: i.runtimeCurrent,
      appBundle: tmp,
    });
    for (const copy of layout.copies) {
      fs.mkdirSync(path.posix.dirname(copy.to), { recursive: true });
      fs.copyFileSync(copy.from, copy.to);
    }
    for (const link of layout.links) {
      fs.mkdirSync(path.posix.dirname(link.link), { recursive: true });
      fs.symlinkSync(link.target, link.link);
    }
  });

  pruneDir(i.runtimeRoot, (entry) => entry === 'current' || entry === i.version);
  return runtimeDir;
}

export function macWrapperIntact(appBundle: string, runtimeCurrent: string): boolean {
  return (
    fs.existsSync(path.posix.join(appBundle, 'Contents/MacOS/steam_osx')) &&
    fs.existsSync(path.posix.join(runtimeCurrent, 'steam_osx'))
  );
}
