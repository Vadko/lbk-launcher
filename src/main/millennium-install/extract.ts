import * as fs from 'node:fs';
import * as path from 'node:path';
import { extract, ReadEntry } from 'tar';
import { extractArchive } from '@/main/installer/archive';

export function isSafeArchiveEntry(entry: string): boolean {
  const normalized = entry.replace(/\\/g, '/');
  if (normalized === '' || normalized.startsWith('/') || /^[A-Za-z]:/.test(normalized)) {
    return false;
  }
  return !normalized.split('/').some((segment) => segment === '..');
}

function isSafeTarEntry(base: string, entryPath: string, entry: ReadEntry): boolean {
  if (!isSafeArchiveEntry(entryPath)) {
    return false;
  }
  if (entry.type === 'Link') {
    return isSafeArchiveEntry(entry.linkpath ?? '');
  }
  if (entry.type === 'SymbolicLink') {
    const dir = path.dirname(path.resolve(base, entryPath));
    return !escapesRoot(base, dir, entry.linkpath ?? '');
  }
  return true;
}

// node-tar would silently strip `..` and absolute prefixes; a pinned archive that has them is refused instead.
async function extractTarGz(archive: string, dest: string): Promise<void> {
  const base = path.resolve(dest);
  let unsafe: string | null = null;
  await extract({
    file: archive,
    cwd: base,
    strict: true,
    filter: (entryPath, entry) => {
      const safe = entry instanceof ReadEntry && isSafeTarEntry(base, entryPath, entry);
      if (!safe) {
        unsafe ??= entryPath;
      }
      return safe;
    },
  });
  if (unsafe !== null) {
    throw new Error(`unsafe archive entry: ${unsafe}`);
  }
}

function escapesRoot(root: string, dir: string, target: string): boolean {
  if (path.isAbsolute(target)) {
    return true;
  }
  const resolved = path.resolve(dir, target);
  return resolved !== root && !resolved.startsWith(`${root}${path.sep}`);
}

// The install steps copy and follow these links later, so one pointing out of the tree would pull in foreign files.
export function findEscapingLink(root: string): string | null {
  const base = path.resolve(root);
  const walk = (dir: string): string | null => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isSymbolicLink()) {
        if (escapesRoot(base, dir, fs.readlinkSync(full))) {
          return full;
        }
      } else if (entry.isDirectory()) {
        const found = walk(full);
        if (found) {
          return found;
        }
      }
    }
    return null;
  };
  return walk(base);
}

// Extracts into a fresh `dest`; node-tar keeps the modes and symlinks the release ships.
export async function extractMillenniumArchive(
  archive: string,
  kind: 'zip' | 'tar.gz',
  dest: string
): Promise<void> {
  fs.rmSync(dest, { recursive: true, force: true });
  fs.mkdirSync(dest, { recursive: true });
  if (kind === 'zip') {
    await extractArchive(archive, dest);
  } else {
    await extractTarGz(archive, dest);
  }
  const escaping = findEscapingLink(dest);
  if (escaping !== null) {
    throw new Error(`unsafe archive link: ${path.relative(dest, escaping)}`);
  }
}

export function missingFiles(root: string, rels: readonly string[]): string[] {
  return rels.filter((rel) => !fs.existsSync(path.join(root, rel)));
}
