import { LRUCache } from 'lru-cache';
import * as path from 'path';
import { isPathInside } from '@/main/utils/fs-safe';
import type { WinePrefixRef } from '@/shared/wine-types';
import {
  findSteamGameInLibraries,
  type InstalledSteamGames,
  isValidSteamPath,
  readSteamLibraryFolders,
  scanSteamGames,
} from '../game-detector/steam-library';
import { wineToHostPath } from './dos-path';
import { listWinePrefixes } from './prefixes';
import { readWineRegistry, regString } from './wine-registry';

/** The Windows Steam client inside one Wine prefix. */
export interface BottleSteam {
  prefix: WinePrefixRef;
  steamPath: string;
}

const BOTTLE_STEAM_DIRS = ['Program Files (x86)/Steam', 'Program Files/Steam'];

function bottleSteamPath(prefix: string): string | null {
  const registered = regString(
    readWineRegistry(prefix, 'user.reg'),
    'Software\\Valve\\Steam',
    'SteamPath'
  );
  const fromRegistry = registered === null ? null : wineToHostPath(prefix, registered);
  const candidates = [
    ...(fromRegistry ? [fromRegistry] : []),
    ...BOTTLE_STEAM_DIRS.map((dir) => path.join(prefix, 'drive_c', dir)),
  ];
  return candidates.find(isValidSteamPath) ?? null;
}

// user.reg is read once per prefix snapshot, not on every lookup of a game
const steamsOfSnapshot = new LRUCache<
  readonly WinePrefixRef[],
  { steams: BottleSteam[] }
>({
  max: 1,
  memoMethod: (prefixes) => ({
    steams: prefixes.flatMap((prefix) => {
      const steamPath = bottleSteamPath(prefix.prefix);
      return steamPath === null ? [] : [{ prefix, steamPath }];
    }),
  }),
});

/** The Steam of every Wine prefix that has one; none off macOS, where LBK lists no prefixes. */
export function bottleSteams(): BottleSteam[] {
  return steamsOfSnapshot.memo(listWinePrefixes()).steams;
}

/** The Steam of the Wine prefix a game folder lies in. */
export function bottleSteamOf(gamePath: string): BottleSteam | null {
  return (
    bottleSteams().find((bottle) => isPathInside(bottle.prefix.prefix, gamePath)) ?? null
  );
}

// A Steam inside Wine writes its libraries as Windows paths, which only the prefix's drive links resolve on the host
function readLibraryFolders(bottle: BottleSteam): string[] {
  return readSteamLibraryFolders(bottle.steamPath, (libraryPath) =>
    wineToHostPath(bottle.prefix.prefix, libraryPath)
  );
}

// Kept until the watcher sees a library change, keyed by the bottle Steam's folder
const folderCache = new LRUCache<string, string[], BottleSteam>({
  max: 32,
  memoMethod: (_steamPath, _stale, { context: bottle }) => {
    const folders = readLibraryFolders(bottle);
    console.log(
      `[Wine] Steam libraries of ${bottle.prefix.label}: ${folders.join(', ')}`
    );
    return folders;
  },
});

const gameCache = new LRUCache<string, InstalledSteamGames, BottleSteam>({
  max: 32,
  memoMethod: (_steamPath, _stale, { context: bottle }) =>
    scanSteamGames(libraryFolders(bottle)),
});

function libraryFolders(bottle: BottleSteam): string[] {
  return folderCache.memo(bottle.steamPath, { context: bottle });
}

function installedGames(bottle: BottleSteam): InstalledSteamGames {
  return gameCache.memo(bottle.steamPath, { context: bottle });
}

/** The steamapps folders of every bottle Steam, read afresh. */
export function readBottleSteamLibraryFolders(): string[] {
  return bottleSteams().flatMap(readLibraryFolders);
}

export function bottleInstalledSteamGames(): InstalledSteamGames[] {
  return bottleSteams().map(installedGames);
}

export function findBottleSteamGame(
  bottle: BottleSteam,
  gameFolderName: string | null,
  steamAppId?: number | null
): string | null {
  return findSteamGameInLibraries(
    libraryFolders(bottle),
    () => installedGames(bottle),
    gameFolderName,
    steamAppId
  );
}

export function invalidateBottleSteamCaches(): void {
  steamsOfSnapshot.clear();
  folderCache.clear();
  gameCache.clear();
}
