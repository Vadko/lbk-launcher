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
import { readUserRegString } from './wine-registry';

/** The Windows Steam client inside one Wine prefix. */
export interface BottleSteam {
  prefix: WinePrefixRef;
  steamPath: string;
}

const BOTTLE_STEAM_DIRS = ['Program Files (x86)/Steam', 'Program Files/Steam'];

const cache: {
  // user.reg is read once per prefix snapshot, not on every lookup of a game
  bottles: { from: readonly WinePrefixRef[]; steams: BottleSteam[] } | null;
  folders: Map<string, string[]>;
  games: Map<string, InstalledSteamGames>;
} = { bottles: null, folders: new Map(), games: new Map() };

function bottleSteamPath(prefix: string): string | null {
  const registered = readUserRegString(prefix, 'Software\\Valve\\Steam', 'SteamPath');
  const fromRegistry = registered === null ? null : wineToHostPath(prefix, registered);
  const candidates = [
    ...(fromRegistry ? [fromRegistry] : []),
    ...BOTTLE_STEAM_DIRS.map((dir) => path.join(prefix, 'drive_c', dir)),
  ];
  return candidates.find(isValidSteamPath) ?? null;
}

/** The Steam of every Wine prefix that has one; none off macOS, where LBK lists no prefixes. */
export function bottleSteams(): BottleSteam[] {
  const prefixes = listWinePrefixes();
  if (cache.bottles?.from !== prefixes) {
    cache.bottles = {
      from: prefixes,
      steams: prefixes.flatMap((prefix) => {
        const steamPath = bottleSteamPath(prefix.prefix);
        return steamPath === null ? [] : [{ prefix, steamPath }];
      }),
    };
    cache.games.clear();
  }
  return cache.bottles.steams;
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

function libraryFolders(bottle: BottleSteam): string[] {
  const cached = cache.folders.get(bottle.steamPath);
  if (cached) {
    return cached;
  }
  const folders = readLibraryFolders(bottle);
  console.log(`[Wine] Steam libraries of ${bottle.prefix.label}: ${folders.join(', ')}`);
  cache.folders.set(bottle.steamPath, folders);
  return folders;
}

function installedGames(bottle: BottleSteam): InstalledSteamGames {
  const cached = cache.games.get(bottle.steamPath);
  if (cached) {
    return cached;
  }
  const games = scanSteamGames(libraryFolders(bottle));
  cache.games.set(bottle.steamPath, games);
  return games;
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
  cache.bottles = null;
  cache.folders.clear();
  cache.games.clear();
}
