import * as fs from 'node:fs';
import { isPathInside, readlinkOrNull, realpathOrNull } from '@/main/utils/fs-safe';

// Millennium's bootstrap dlopens MILLENNIUM_RUNTIME_PATH as it is, missing or not, and falls back to this only when it is unset.
export const BOOTSTRAP_DEFAULT_RUNTIME = '/usr/lib/millennium/libmillennium_x86.so';

// Our links resolve through any symlinked part of $HOME, so both spellings count.
export function runtimeRoots(runtimeRoot: string): string[] {
  return [runtimeRoot, realpathOrNull(runtimeRoot)].filter(
    (root): root is string => root !== null
  );
}

export function reachesRuntime(
  p: string | null | undefined,
  roots: readonly string[]
): boolean {
  if (!p) {
    return false;
  }
  const resolved = realpathOrNull(p);
  return roots.some(
    (root) => isPathInside(root, p) || (resolved !== null && isPathInside(root, resolved))
  );
}

// Steam's libXtst links load our bootstrap, which then loads our runtime.
export function linksReachRuntime(
  links: readonly string[],
  roots: readonly string[]
): boolean {
  return links.some(
    (link) =>
      reachesRuntime(readlinkOrNull(link), roots) ||
      reachesRuntime(realpathOrNull(link), roots)
  );
}

// environment.d is read at login, so this session (and LBK, started in it) keeps the value after our env file is gone.
export function runtimeInUse(i: {
  runtimeRoot: string;
  links: readonly string[];
  envFile: string;
  sessionValue: string | undefined;
}): boolean {
  const roots = runtimeRoots(i.runtimeRoot);
  return (
    linksReachRuntime(i.links, roots) ||
    fs.existsSync(i.envFile) ||
    reachesRuntime(i.sessionValue, roots)
  );
}
