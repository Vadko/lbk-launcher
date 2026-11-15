import * as fs from 'fs';
import * as path from 'path';
import { isPathInside, readlinkOrNull } from '@/main/utils/fs-safe';

const DRIVE_PATH = /^([a-zA-Z]):(?:[\\/]+(.*))?$/;
const DRIVE_LINK = /^([a-z]):$/;

export function isWinePrefix(dir: string): boolean {
  return (
    fs.existsSync(path.join(dir, 'drive_c')) &&
    fs.existsSync(path.join(dir, 'system.reg'))
  );
}

function dosDevicesDir(prefix: string): string {
  return path.join(prefix, 'dosdevices');
}

function driveRoot(prefix: string, letter: string): string | null {
  const target = readlinkOrNull(
    path.join(dosDevicesDir(prefix), `${letter.toLowerCase()}:`)
  );
  return target === null ? null : path.resolve(dosDevicesDir(prefix), target);
}

// Steam writes some paths lowercased ("c:/program files (x86)/steam"); the folder's own spelling keeps path comparisons exact
function joinCaseInsensitive(root: string, segments: readonly string[]): string {
  let current = root;
  for (const segment of segments) {
    const lower = segment.toLowerCase();
    let entries: string[] = [];
    try {
      entries = fs.readdirSync(current);
    } catch {
      // A missing folder keeps the segment as written
    }
    const match =
      entries.find((entry) => entry === segment) ??
      entries.find((entry) => entry.toLowerCase() === lower);
    current = path.join(current, match ?? segment);
  }
  return current;
}

/** The host path a Windows path of this prefix points at, or null for a path on no mapped drive. */
export function wineToHostPath(prefix: string, winPath: string): string | null {
  const match = DRIVE_PATH.exec(winPath.trim());
  if (!match) {
    return null;
  }
  const root = driveRoot(prefix, match[1]);
  if (root === null) {
    return null;
  }
  const segments = (match[2] ?? '').split(/[\\/]+/).filter(Boolean);
  return joinCaseInsensitive(root, segments);
}

/** The Windows path a program in this prefix sees for a host path, through the drive that maps the most of it. */
export function hostToWinePath(prefix: string, hostPath: string): string | null {
  const target = path.resolve(hostPath);
  let best: { letter: string; root: string } | null = null;
  let entries: string[];
  try {
    entries = fs.readdirSync(dosDevicesDir(prefix));
  } catch {
    return null;
  }
  for (const entry of entries) {
    const letter = DRIVE_LINK.exec(entry)?.[1];
    const root = letter ? driveRoot(prefix, letter) : null;
    if (!letter || root === null) {
      continue;
    }
    const covers = target === root || isPathInside(root, target);
    if (covers && (best === null || root.length > best.root.length)) {
      best = { letter, root };
    }
  }
  if (best === null) {
    return null;
  }
  const rest = path.relative(best.root, target).split(path.sep).filter(Boolean);
  return `${best.letter.toUpperCase()}:\\${rest.join('\\')}`;
}

/** The prefix whose drive_c holds this host path, found from the path alone. */
export function winePrefixOf(hostPath: string): string | null {
  let dir = path.resolve(hostPath);
  for (;;) {
    const parent = path.dirname(dir);
    if (parent === dir) {
      return null;
    }
    if (
      path.basename(dir) === 'drive_c' &&
      fs.existsSync(path.join(parent, 'system.reg'))
    ) {
      return parent;
    }
    dir = parent;
  }
}
