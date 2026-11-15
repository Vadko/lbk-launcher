import type { Platform } from '@/shared/types';
import type { WinePrefixRef } from '@/shared/wine-types';
import { launchInBottleEpic } from './bottle-epic';
import { launchInBottleGog } from './bottle-gog';
import { launchInBottleSteam } from './bottle-steam';

interface BottleCopy {
  platform: Platform;
  path: string;
  wine: WinePrefixRef;
}

type Launcher = (
  copy: BottleCopy,
  steamAppId: () => Promise<number | null>
) => boolean | Promise<boolean>;

const LAUNCHERS: Partial<Record<Platform, Launcher>> = {
  steam: async (copy, steamAppId) => {
    const appId = await steamAppId();
    return appId !== null && launchInBottleSteam(copy.path, appId);
  },
  gog: (copy) => launchInBottleGog(copy.wine, copy.path),
  epic: (copy) => launchInBottleEpic(copy.wine, copy.path),
};

/** Starts a game copy in a Wine prefix through that prefix's own store client; a macOS process cannot run it. */
export function launchBottleCopy(
  copy: BottleCopy,
  steamAppId: () => Promise<number | null>
): Promise<boolean> {
  const launch = LAUNCHERS[copy.platform];
  if (!launch) {
    console.warn(`[Wine] No ${copy.platform} client is read in ${copy.wine.prefix}`);
    return Promise.resolve(false);
  }
  return Promise.resolve(launch(copy, steamAppId));
}
