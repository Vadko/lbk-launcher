import type { ResourceMap } from '../shared/resources';
import { GamesRepository } from './db/games-repository';
import { getAllInstalledGamePaths } from './game-detector';
import { getInstalledSteamAppIds } from './game-detector/steam';
import { whenXboxRootsScanned } from './game-detector/xbox';

// Steam games match by app id too, so a machine with no other game folders still lists them
export async function getHomeInstalledGames(
  hideAiTranslations: boolean
): Promise<ResourceMap['homeInstalled']> {
  await whenXboxRootsScanned();
  const paths = getAllInstalledGamePaths();
  const { games } = GamesRepository.getInstance().findGamesByInstallPaths(
    paths,
    undefined,
    hideAiTranslations,
    'newest',
    getInstalledSteamAppIds()
  );
  return { games, installedPathsCount: paths.length };
}
