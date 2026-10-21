import * as path from 'node:path';
import { getSteamPath } from '@/main/game-detector/steam';
import { isLinux } from '@/main/utils/platform';
import { LINUX_RUNTIME_LIB, RUNTIME_PATH_ENV } from './linux';
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
  const record = readInstallRecord(recordPathIn(paths.root));
  if (
    !paths.linux ||
    record?.mode !== 'linux-user' ||
    managedByFor(record, 'linux', steamPath) !== 'lbk'
  ) {
    return {};
  }
  return { [RUNTIME_PATH_ENV]: path.posix.join(paths.linux.current, LINUX_RUNTIME_LIB) };
}
