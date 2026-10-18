import * as os from 'node:os';
import * as path from 'node:path';
import { isFlatpak } from '@/main/utils/host-exec';
import { resolveMillenniumPaths } from '@/main/utils/millennium';
import type { MillenniumOs } from './release';

export interface MillenniumPathInputs {
  os: MillenniumOs;
  home: string;
  steamPath: string;
  env: Record<string, string | undefined>;
  insideFlatpak: boolean;
}

export interface MillenniumInstallPaths {
  // Millennium's data root; holds plugins and LBK's install record.
  root: string;
  pluginsDir: string;
  configPath: string;
  // Extra dirs a purge removes on top of `root`.
  purgeDirs: string[];
  linux: null | {
    runtimeRoot: string;
    current: string;
    envFile: string;
    steamHome: string;
  };
  macos: null | {
    runtimeRoot: string;
    current: string;
    appBundle: string;
    steamuiMillennium: string;
  };
}

export const LINUX_ENV_FILE_NAME = 'lbk-millennium.conf';
export const MAC_WRAPPER_APP = 'Steam Millennium.app';

export function millenniumInstallPaths(i: MillenniumPathInputs): MillenniumInstallPaths {
  const resolved = resolveMillenniumPaths(i);
  const pluginsDir = resolved.pluginsDirs[0];
  const configPath = resolved.configPaths[0];

  if (i.os === 'windows') {
    return {
      root: path.win32.dirname(pluginsDir),
      pluginsDir,
      configPath,
      purgeDirs: [],
      linux: null,
      macos: null,
    };
  }

  if (i.os === 'macos') {
    const root = path.posix.dirname(pluginsDir);
    const runtimeRoot = path.posix.join(root, 'runtime');
    return {
      root,
      pluginsDir,
      configPath,
      purgeDirs: [],
      linux: null,
      macos: {
        runtimeRoot,
        current: path.posix.join(runtimeRoot, 'current'),
        appBundle: path.posix.join(i.home, 'Applications', MAC_WRAPPER_APP),
        steamuiMillennium: path.posix.join(
          i.home,
          'Library/Application Support/Steam/Steam.AppBundle/Steam/Contents/MacOS/steamui/millennium'
        ),
      },
    };
  }

  // Same rule as resolveMillenniumPaths: inside our Flatpak XDG_* points at the sandbox.
  const xdg = (name: string, fallback: string) =>
    (!i.insideFlatpak && i.env[name]) || path.posix.join(i.home, fallback);
  const runtimeRoot = path.posix.join(i.home, '.local/lib/lbk-millennium');
  return {
    root: path.posix.dirname(pluginsDir),
    pluginsDir,
    configPath,
    purgeDirs: [
      path.posix.dirname(configPath),
      path.posix.join(xdg('XDG_STATE_HOME', '.local/state'), 'millennium'),
    ],
    linux: {
      runtimeRoot,
      current: path.posix.join(runtimeRoot, 'current'),
      envFile: path.posix.join(
        xdg('XDG_CONFIG_HOME', '.config'),
        'environment.d',
        LINUX_ENV_FILE_NAME
      ),
      steamHome: path.posix.join(i.home, '.steam/steam'),
    },
    macos: null,
  };
}

export function installPathsFor(
  platform: MillenniumOs,
  steamPath: string
): MillenniumInstallPaths {
  return millenniumInstallPaths({
    os: platform,
    home: os.homedir(),
    steamPath,
    env: process.env,
    insideFlatpak: isFlatpak(),
  });
}
