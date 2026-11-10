import * as fs from 'fs';
import * as path from 'path';
import { parseLibraryFolders } from '@/main/utils/vdf-parser';
import { wineToHostPath } from '@/main/wine/dos-path';
import { listWinePrefixes } from '@/main/wine/prefixes';
import { readUserRegString } from '@/main/wine/wine-registry';

/** A Steam install LBK reads games from: the native client, or the Windows client inside a Wine prefix. */
export interface SteamRoot {
  steamPath: string;
  prefix: string | null;
}

const LIBRARY_FOLDERS_FILE = 'libraryfolders.vdf';

const BOTTLE_STEAM_DIRS = ['Program Files (x86)/Steam', 'Program Files/Steam'];

export function isValidSteamPath(steamPath: string): boolean {
  try {
    const requiredDirs = ['steamapps', 'appcache', 'config'];
    return requiredDirs.every((dir) => fs.existsSync(path.join(steamPath, dir)));
  } catch {
    return false;
  }
}

function bottleSteamPath(prefix: string): string | null {
  const registered = readUserRegString(prefix, 'Software\\Valve\\Steam', 'SteamPath');
  const fromRegistry = registered === null ? null : wineToHostPath(prefix, registered);
  const candidates = [
    ...(fromRegistry ? [fromRegistry] : []),
    ...BOTTLE_STEAM_DIRS.map((dir) => path.join(prefix, 'drive_c', dir)),
  ];
  return candidates.find(isValidSteamPath) ?? null;
}

export function bottleSteamRoots(): SteamRoot[] {
  return listWinePrefixes().flatMap(({ prefix }) => {
    const steamPath = bottleSteamPath(prefix);
    return steamPath === null ? [] : [{ steamPath, prefix }];
  });
}

function realpathOr(dir: string): string {
  try {
    return fs.realpathSync(dir);
  } catch {
    return dir;
  }
}

// A Steam inside Wine writes its libraries as Windows paths, which only the prefix's drive links resolve on the host.
function libraryHostPath(root: SteamRoot, libraryPath: string): string | null {
  const normalized = libraryPath.replace(/\\\\/g, '\\');
  return root.prefix === null ? normalized : wineToHostPath(root.prefix, normalized);
}

/** The steamapps folders of one Steam root, its own first, with symlinked duplicates dropped. */
export function readSteamLibraryFolders(root: SteamRoot): string[] {
  const own = path.join(root.steamPath, 'steamapps');
  const folders = [own];
  const seen = new Set([realpathOr(own)]);
  try {
    const file = path.join(own, LIBRARY_FOLDERS_FILE);
    if (!fs.existsSync(file)) {
      return folders;
    }
    for (const libraryPath of parseLibraryFolders(fs.readFileSync(file, 'utf8'))) {
      const hostPath = libraryHostPath(root, libraryPath);
      const steamapps = hostPath === null ? null : path.join(hostPath, 'steamapps');
      if (steamapps === null || !fs.existsSync(steamapps)) {
        continue;
      }
      const real = realpathOr(steamapps);
      if (!seen.has(real)) {
        seen.add(real);
        folders.push(steamapps);
      }
    }
  } catch (error) {
    console.error('[Steam] Error parsing library folders:', error);
  }
  return folders;
}
