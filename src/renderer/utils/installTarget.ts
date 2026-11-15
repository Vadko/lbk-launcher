import type { GamePath, InstallationInfo, Platform } from '@/shared/types';

const AUTO = 'auto';

/** The dropdown value of one detected copy: its store, and its Wine prefix when it lives in one. */
export function copyKey(copy: GamePath): string {
  return copy.wine ? `${copy.platform}@${copy.wine.prefix}` : copy.platform;
}

interface InstallTarget {
  platform: Platform | 'auto';
  // undefined lets main pick the first copy found, null asks for the native one
  winePrefix: string | null | undefined;
  // The copy the install goes into, as far as the renderer can tell
  copy: GamePath | undefined;
}

export function installTarget(
  selected: string,
  copies: readonly GamePath[]
): InstallTarget {
  const chosen = copies.find((copy) => copyKey(copy) === selected);
  if (selected === AUTO || !chosen) {
    return {
      platform: 'auto',
      winePrefix: undefined,
      copy: copies.find((c) => c.exists),
    };
  }
  return {
    platform: chosen.platform,
    winePrefix: chosen.wine?.prefix ?? null,
    copy: chosen,
  };
}

/** A reinstall starts on the copy the translation is in; a new install lets main choose. */
export function defaultCopyKey(
  copies: readonly GamePath[],
  installationInfo: InstallationInfo | undefined
): string {
  if (!installationInfo) {
    return AUTO;
  }
  const installed =
    copies.find((copy) => copy.exists && copy.path === installationInfo.gamePath) ??
    copies.find((copy) => copy.exists);
  return installed ? copyKey(installed) : AUTO;
}
