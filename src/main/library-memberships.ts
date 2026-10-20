import type { Game, LibraryFilterType, LibraryMemberships } from '../shared/types';
import { GamesRepository } from './db/games-repository';
import { getAllInstalledGamePaths } from './game-detector';
import { getInstalledSteamAppIds, getSteamLibraryAppIds } from './game-detector/steam';
import {
  getEpicLibrary,
  getGogLibrary,
  getInstalledXboxGamePaths,
} from './game-detector/store-cache';
import { whenXboxRootsScanned } from './game-detector/xbox';

async function resolveIds(
  filter: LibraryFilterType,
  findGames: () => Promise<{ games: Game[] }> | { games: Game[] }
): Promise<string[]> {
  try {
    const { games } = await findGames();
    return games.map((game) => game.id);
  } catch (error) {
    console.error(`[GameDetector] Library membership for ${filter} failed:`, error);
    return [];
  }
}

/** Same finders and probes as the sidebar list's library filters, reduced to game ids. */
export async function getLibraryMemberships(): Promise<LibraryMemberships> {
  const repo = GamesRepository.getInstance();
  await whenXboxRootsScanned();

  return {
    'installed-games': await resolveIds('installed-games', () =>
      repo.findGamesByInstallPaths(
        getAllInstalledGamePaths(),
        undefined,
        false,
        'name',
        getInstalledSteamAppIds()
      )
    ),
    'available-in-steam': await resolveIds('available-in-steam', async () =>
      repo.findGamesBySteamAppIds(await getSteamLibraryAppIds())
    ),
    'owned-gog-games': await resolveIds('owned-gog-games', () =>
      repo.findGamesByTitles(getGogLibrary())
    ),
    'owned-epic-games': await resolveIds('owned-epic-games', () =>
      repo.findGamesByTitles(getEpicLibrary())
    ),
    'installed-xbox-games': await resolveIds('installed-xbox-games', () =>
      repo.findGamesByXboxPaths(getInstalledXboxGamePaths())
    ),
  };
}
