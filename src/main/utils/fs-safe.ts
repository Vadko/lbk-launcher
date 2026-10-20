import * as fs from 'node:fs';
import * as path from 'node:path';

export function readFileOrNull(file: string): Buffer | null {
  try {
    return fs.readFileSync(file);
  } catch {
    return null;
  }
}

export function readTextOrNull(file: string): string | null {
  try {
    return fs.readFileSync(file, 'utf8');
  } catch {
    return null;
  }
}

export function readlinkOrNull(link: string): string | null {
  try {
    return fs.readlinkSync(link);
  } catch {
    return null;
  }
}

export function realpathOrNull(p: string): string | null {
  try {
    return fs.realpathSync(p);
  } catch {
    return null;
  }
}

export function isPathInside(parent: string, child: string): boolean {
  const rel = path.relative(parent, child);
  return (
    rel !== '' &&
    rel !== '..' &&
    !rel.startsWith(`..${path.sep}`) &&
    !path.isAbsolute(rel)
  );
}

// Same inode on the same device: a hardlink is the same file under another name.
export function isSameFile(a: string, b: string): boolean {
  const sa = fs.statSync(a, { bigint: true, throwIfNoEntry: false });
  const sb = fs.statSync(b, { bigint: true, throwIfNoEntry: false });
  return sa !== undefined && sb !== undefined && sa.ino === sb.ino && sa.dev === sb.dev;
}

export function missingFiles(root: string, rels: readonly string[]): string[] {
  return rels.filter((rel) => !fs.existsSync(path.join(root, rel)));
}

// A missing `dir` has nothing to prune.
export function pruneDir(dir: string, keep: (entry: string) => boolean): void {
  let entries: string[];
  try {
    entries = fs.readdirSync(dir);
  } catch {
    return;
  }
  for (const entry of entries) {
    if (!keep(entry)) {
      fs.rmSync(path.join(dir, entry), { recursive: true, force: true });
    }
  }
}
