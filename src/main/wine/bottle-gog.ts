import * as fs from 'node:fs';
import * as path from 'node:path';
import type { WinePrefixRef } from '@/shared/wine-types';
import { hostToWinePath, wineToHostPath } from './dos-path';
import { startInWine } from './run';
import { type RegKeys, readWineRegistry, regString, regSubkeys } from './wine-registry';

/** A game GOG Galaxy or a GOG offline installer put into a Wine prefix. */
export interface BottleGogGame {
  path: string;
  gameId: string;
  /** The game's own executable and its arguments, for a prefix without Galaxy */
  exe: string | null;
  launchParam: string;
}

// Galaxy 2.1 is 64-bit and writes both views of HKLM; older Galaxy and the offline installers only the 32-bit one
const GOG_KEYS = ['Software\\Wow6432Node\\GOG.com', 'Software\\GOG.com'];

function registeredGames(registry: RegKeys): [string, ReadonlyMap<string, string>][] {
  const games = new Map<string, ReadonlyMap<string, string>>();
  for (const key of GOG_KEYS) {
    for (const [id, values] of regSubkeys(registry, `${key}\\Games`)) {
      if (!games.has(id)) {
        games.set(id, values);
      }
    }
  }
  return [...games];
}

function gogGamesIn(prefix: string, registry: RegKeys): BottleGogGame[] {
  return registeredGames(registry).flatMap(([gameId, values]) => {
    const winPath = values.get('path');
    const gamePath = winPath ? wineToHostPath(prefix, winPath) : null;
    // A DLC registers under its game's id with dependsOn
    if (values.get('dependson') || !gamePath || !fs.existsSync(gamePath)) {
      return [];
    }
    const exe = values.get('exe');
    return [
      {
        path: gamePath,
        gameId: values.get('gameid') || gameId,
        exe: exe ? wineToHostPath(prefix, exe) : null,
        launchParam: values.get('launchparam') ?? '',
      },
    ];
  });
}

export function bottleGogGames(prefix: string): BottleGogGame[] {
  return gogGamesIn(prefix, readWineRegistry(prefix, 'system.reg'));
}

/** The game whose folder has exactly this name, as the native detector matches it. */
export function findBottleGogGame(prefix: string, folderName: string): string | null {
  return (
    bottleGogGames(prefix).find((game) => path.basename(game.path) === folderName)
      ?.path ?? null
  );
}

function galaxyClient(prefix: string, registry: RegKeys): string | null {
  for (const key of GOG_KEYS) {
    const dir = regString(registry, `${key}\\GalaxyClient\\paths`, 'client');
    const exe =
      regString(registry, `${key}\\GalaxyClient`, 'clientExecutable') ??
      'GalaxyClient.exe';
    const hostDir = dir ? wineToHostPath(prefix, dir) : null;
    const client = hostDir ? path.join(hostDir, exe) : null;
    if (client && fs.existsSync(client)) {
      return client;
    }
  }
  return null;
}

/** Starts the game through the bottle's GOG Galaxy, or its own executable where Galaxy is not installed. */
export function launchInBottleGog(prefix: WinePrefixRef, gamePath: string): boolean {
  const registry = readWineRegistry(prefix.prefix, 'system.reg');
  const game = gogGamesIn(prefix.prefix, registry).find(
    (entry) => entry.path === gamePath
  );
  if (!game) {
    console.warn(`[Wine] No GOG game registered at ${gamePath}`);
    return false;
  }
  const client = galaxyClient(prefix.prefix, registry);
  const winPath = hostToWinePath(prefix.prefix, gamePath);
  if (client && winPath) {
    return startInWine(prefix, client, [
      '/command=runGame',
      `/gameId=${game.gameId}`,
      `/path=${winPath}`,
    ]);
  }
  if (game.exe && fs.existsSync(game.exe)) {
    return startInWine(prefix, game.exe, game.launchParam.split(' ').filter(Boolean));
  }
  console.warn(`[Wine] Neither Galaxy nor the game executable for ${gamePath}`);
  return false;
}
