import { G } from '@mobily/ts-belt';
import type { InstallPath, Platform } from '../../shared/types';
import type { WinePrefixRef } from '../../shared/wine-types';
import type { GamePath } from '../game-detector/types';
import { findBottleEpicGame } from './bottle-epic';
import { findBottleGogGame } from './bottle-gog';
import { bottleSteams, findBottleSteamGame } from './bottle-steam-roots';
import { listWinePrefixes } from './prefixes';

type CopyFinder = (
  prefix: WinePrefixRef,
  installPath: InstallPath,
  steamAppId?: number | null
) => string | null;

// The stores whose Windows client LBK reads inside a prefix
const FINDERS: Partial<Record<Platform, CopyFinder>> = {
  steam: (prefix, installPath, steamAppId) => {
    const bottle = bottleSteams().find((steam) => steam.prefix.prefix === prefix.prefix);
    return bottle && (installPath.path || !G.isNullable(steamAppId))
      ? findBottleSteamGame(bottle, installPath.path, steamAppId)
      : null;
  },
  gog: (prefix, installPath) =>
    installPath.path ? findBottleGogGame(prefix.prefix, installPath.path) : null,
  epic: (prefix, installPath) =>
    installPath.path ? findBottleEpicGame(prefix.prefix, installPath.path) : null,
};

function copyIn(
  prefix: WinePrefixRef,
  installPath: InstallPath,
  steamAppId?: number | null
): GamePath | null {
  const platform = installPath.type;
  const found = platform
    ? (FINDERS[platform]?.(prefix, installPath, steamAppId) ?? null)
    : null;
  return platform && found !== null
    ? { platform, path: found, exists: true, wine: prefix }
    : null;
}

/** The copies of a game in every Wine prefix, which the native copies come before. */
export function bottleGameCopies(
  installPaths: InstallPath[],
  steamAppId?: number | null
): GamePath[] {
  return listWinePrefixes().flatMap((prefix) =>
    installPaths.flatMap((installPath) => copyIn(prefix, installPath, steamAppId) ?? [])
  );
}

/** The copy of a game in one Wine prefix, the one an install or a launch asked for. */
export function findBottleGameCopy(
  installPath: InstallPath | null | undefined,
  steamAppId: number | null | undefined,
  prefix: string
): GamePath | null {
  const ref = listWinePrefixes().find((entry) => entry.prefix === prefix);
  return ref && installPath ? copyIn(ref, installPath, steamAppId) : null;
}
