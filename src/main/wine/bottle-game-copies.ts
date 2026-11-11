import { G } from '@mobily/ts-belt';
import type { InstallPath } from '../../shared/types';
import type { GamePath } from '../game-detector/types';
import {
  type BottleSteam,
  bottleSteams,
  findBottleSteamGame,
} from './bottle-steam-roots';

// Only the Steam inside a bottle is read: no other store's client is looked for there
function copyIn(
  bottle: BottleSteam,
  installPath: InstallPath,
  steamAppId?: number | null
): GamePath | null {
  if (installPath.type !== 'steam' || (!installPath.path && G.isNullable(steamAppId))) {
    return null;
  }
  const found = findBottleSteamGame(bottle, installPath.path, steamAppId);
  return found === null
    ? null
    : { platform: 'steam', path: found, exists: true, wine: bottle.prefix };
}

/** The copies of a game in the Steam of every Wine prefix, which the native copies come before. */
export function bottleGameCopies(
  installPaths: InstallPath[],
  steamAppId?: number | null
): GamePath[] {
  return bottleSteams().flatMap((bottle) =>
    installPaths.flatMap((installPath) => copyIn(bottle, installPath, steamAppId) ?? [])
  );
}

/** The copy of a game in one Wine prefix, the one an install or a launch asked for. */
export function findBottleGameCopy(
  installPath: InstallPath | null | undefined,
  steamAppId: number | null | undefined,
  prefix: string
): GamePath | null {
  const bottle = bottleSteams().find((steam) => steam.prefix.prefix === prefix);
  return bottle && installPath ? copyIn(bottle, installPath, steamAppId) : null;
}
