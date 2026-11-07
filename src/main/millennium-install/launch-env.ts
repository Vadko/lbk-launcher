import * as path from 'node:path';
import { getSteamPath } from '@/main/game-detector/steam';
import { isLinux } from '@/main/utils/platform';
import { LINUX_RUNTIME_LIB, linuxLinkPaths, RUNTIME_PATH_ENV } from './linux';
import {
  BOOTSTRAP_DEFAULT_RUNTIME,
  linksReachRuntime,
  reachesRuntime,
  runtimeRoots,
} from './linux-runtime-use';
import { installPathsFor } from './paths';
import { managedByFor, readInstallRecord, recordPathIn } from './record';

// Steam started by LBK must see the rootless runtime even before the session picked up environment.d.
export function millenniumLaunchEnv(): Record<string, string> {
  if (!isLinux()) {
    return {};
  }
  const steamPath = getSteamPath();
  if (!steamPath) {
    return {};
  }
  const paths = installPathsFor('linux', steamPath);
  if (!paths.linux) {
    return {};
  }
  const record = readInstallRecord(recordPathIn(paths.root));
  if (
    record?.mode === 'linux-user' &&
    managedByFor(record, 'linux', steamPath) === 'lbk'
  ) {
    return {
      [RUNTIME_PATH_ENV]: path.posix.join(paths.linux.current, LINUX_RUNTIME_LIB),
    };
  }
  const roots = runtimeRoots(paths.linux.runtimeRoot);
  // Our install is gone but the session kept our path from login; another Millennium's bootstrap would load that.
  const stale =
    record === null &&
    reachesRuntime(process.env[RUNTIME_PATH_ENV], roots) &&
    !linksReachRuntime(linuxLinkPaths(paths.linux.steamHome), roots);
  return stale ? { [RUNTIME_PATH_ENV]: BOOTSTRAP_DEFAULT_RUNTIME } : {};
}
