import * as path from 'node:path';
import { bottleEpicGames, bottleEpicRecordDirs } from './bottle-epic';
import { bottleGogGames } from './bottle-gog';
import { listWinePrefixes } from './prefixes';

/** Where GOG and Epic record their installs in each Wine prefix: Galaxy and the offline installers in system.reg, EGL as one file per game. */
export function bottleStoreSources(): { registries: string[]; epicDirs: string[] } {
  const prefixes = listWinePrefixes().map((ref) => ref.prefix);
  return {
    registries: prefixes.map((prefix) => path.join(prefix, 'system.reg')),
    epicDirs: prefixes.flatMap(bottleEpicRecordDirs),
  };
}

/** The folders of the GOG and Epic games in every Wine prefix; Steam's come with the Steam scan. */
export function bottleStoreGamePaths(): string[] {
  return listWinePrefixes().flatMap(({ prefix }) => [
    ...bottleGogGames(prefix).map((game) => game.path),
    ...bottleEpicGames(prefix).map((game) => game.path),
  ]);
}
