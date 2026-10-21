import type { ChildProcess } from 'node:child_process';
import { once } from 'node:events';
import { constants, promises as fsp } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {
  type EglLaunchTarget,
  getEglDeepLink,
  getEglLaunchTarget,
} from '../game-detector/egl-linux';
import { listLinuxProcesses } from '../steam-process/list-linux';
import { spawnOnHost } from './host-exec';

// Kernel comm is cut to 15 chars; the AppImage runtime process has the .appimage path as argv0
const EGL_COMMS: ReadonlySet<string> = new Set(['EpicGamesLaunch']);
const APPIMAGE_DIRS = ['Applications', 'AppImages', '.local/bin', 'Downloads', 'Desktop'];
const EGL_APPIMAGE = /^EpicGamesLauncher.*\.appimage$/i;

async function findRunningEglAppImage(): Promise<string | undefined> {
  const rows = (await listLinuxProcesses(EGL_COMMS)) ?? [];
  return rows
    .map((row) => row.args?.match(/^(\/.+?\.appimage)(?:\s|$)/i)?.[1])
    .find((file) => file !== undefined);
}

// EGL writes its own AppImage path nowhere, so when it is not running we look where people keep AppImages
async function findEglAppImage(): Promise<string | undefined> {
  const running = await findRunningEglAppImage();
  if (running) {
    return running;
  }
  const dirs = APPIMAGE_DIRS.map((dir) => path.join(os.homedir(), dir));
  const found = await Promise.all(
    dirs.map(async (dir) =>
      (await fsp.readdir(dir).catch(() => []))
        .filter((file) => EGL_APPIMAGE.test(file))
        .map((file) => path.join(dir, file))
    )
  );
  const executable = await Promise.all(
    found.flat().map((file) =>
      fsp.access(file, constants.X_OK).then(
        () => file,
        () => undefined
      )
    )
  );
  return executable.find((file) => file !== undefined);
}

async function spawned(child: ChildProcess, what: string): Promise<boolean> {
  try {
    await once(child, 'spawn');
    return true;
  } catch (error) {
    console.error(`[EglLauncher] Error spawning ${what}:`, error);
    return false;
  }
}

// No EGL to hand the link to: run what EGL itself runs, its GE-Proton on the host, without Epic auth
function launchWithProton(target: EglLaunchTarget): Promise<boolean> {
  const proton = path.join(target.protonDir, 'proton');
  console.log(`[EglLauncher] Launching ${target.executable} with ${proton}`);
  const child = spawnOnHost(
    proton,
    ['waitforexitandrun', target.executable, ...target.args],
    {
      STEAM_COMPAT_CLIENT_INSTALL_PATH: target.protonDir,
      STEAM_COMPAT_DATA_PATH: target.prefix,
      STEAM_COMPAT_INSTALL_PATH: target.gameDir,
      WINEPREFIX: path.join(target.prefix, 'pfx'),
    },
    path.dirname(target.executable)
  );
  return spawned(child, proton);
}

// EGL registers no URL handler on Linux, but its AppImage takes the link as an argument, cold or running
export async function launchEglGame(gameDir: string): Promise<boolean> {
  const link = getEglDeepLink(gameDir);
  const appImage = link ? await findEglAppImage() : undefined;
  if (link && appImage) {
    console.log(`[EglLauncher] Launching ${link} through ${appImage}`);
    return spawned(spawnOnHost(appImage, [link]), appImage);
  }
  const target = getEglLaunchTarget(gameDir);
  if (!target) {
    console.warn('[EglLauncher] No EGL launch target for:', gameDir);
    return false;
  }
  return launchWithProton(target);
}
