import * as fs from 'node:fs';
import * as path from 'node:path';
import { A } from '@mobily/ts-belt';
import {
  EPIC_INSTALLED_ITEMS_DIR,
  readEpicInstalledItems,
} from '@/main/game-detector/epic-installed-items';
import { parseEpicManifest } from '@/main/game-detector/epic-manifest';
import type { WinePrefixRef } from '@/shared/wine-types';
import { wineToHostPath } from './dos-path';
import { startInWine } from './run';
import { urlHandlerExe } from './url-handler';

/** A game the Epic Games Launcher inside a Wine prefix installed. */
export interface BottleEpicGame {
  path: string;
  /** namespace:itemId:appName, the id its launch link takes; null when the manifest lacks one */
  launchId: string | null;
}

const MANIFESTS = 'C:\\ProgramData\\Epic\\EpicGamesLauncher\\Data\\Manifests';
const EGL_SCHEME = 'com.epicgames.launcher';

/** The folders EGL records its installs in: the .item manifests of older EGL, the .egi items of EGL from 2026. */
export function bottleEpicRecordDirs(prefix: string): string[] {
  return [MANIFESTS, EPIC_INSTALLED_ITEMS_DIR].flatMap(
    (dir) => wineToHostPath(prefix, dir) ?? []
  );
}

function manifestFiles(dir: string): string[] {
  try {
    return fs
      .readdirSync(dir)
      .filter((name) => name.endsWith('.item'))
      .map((name) => path.join(dir, name));
  } catch {
    return [];
  }
}

function manifestGames(prefix: string): BottleEpicGame[] {
  const dir = wineToHostPath(prefix, MANIFESTS);
  return (dir ? manifestFiles(dir) : []).flatMap((file) => {
    const manifest = parseEpicManifest(file);
    // A DLC's manifest shares its game's folder
    const isDlc =
      !!manifest?.mainGameAppName && manifest.mainGameAppName !== manifest.appName;
    if (!manifest || isDlc) {
      return [];
    }
    const { catalogNamespace, catalogItemId, appName } = manifest;
    return [
      {
        path: manifest.installLocation,
        launchId:
          catalogNamespace && catalogItemId && appName
            ? `${catalogNamespace}:${catalogItemId}:${appName}`
            : null,
      },
    ];
  });
}

function installedItemGames(prefix: string): BottleEpicGame[] {
  const dir = wineToHostPath(prefix, EPIC_INSTALLED_ITEMS_DIR);
  return (dir ? readEpicInstalledItems(dir) : []).map((item) => ({
    path: item.dir,
    launchId: item.appId,
  }));
}

export function bottleEpicGames(prefix: string): readonly BottleEpicGame[] {
  const games = [...installedItemGames(prefix), ...manifestGames(prefix)].flatMap(
    (game) => {
      const hostPath = wineToHostPath(prefix, game.path);
      return hostPath && fs.existsSync(hostPath) ? [{ ...game, path: hostPath }] : [];
    }
  );
  // An install EGL migrated can have both records
  return A.uniqBy(games, (game) => game.path);
}

/** The game whose folder has this name, compared without case as the native detector does. */
export function findBottleEpicGame(prefix: string, folderName: string): string | null {
  const wanted = folderName.toLowerCase();
  return (
    bottleEpicGames(prefix).find(
      (game) => path.basename(game.path).toLowerCase() === wanted
    )?.path ?? null
  );
}

/** Asks the bottle's Epic Games Launcher to start the game, which starts the launcher first when it is closed. */
export function launchInBottleEpic(prefix: WinePrefixRef, gamePath: string): boolean {
  const launchId = bottleEpicGames(prefix.prefix).find(
    (game) => game.path === gamePath
  )?.launchId;
  const egl = urlHandlerExe(prefix.prefix, EGL_SCHEME);
  if (!launchId || !egl) {
    console.warn(`[Wine] No Epic Games Launcher or app id for ${gamePath}`);
    return false;
  }
  return startInWine(prefix, egl, [
    `${EGL_SCHEME}://apps/${encodeURIComponent(launchId)}?action=launch&silent=true`,
  ]);
}
