/**
 * Reduce an install path to a comparable folder key: lowercase, strip a leading
 * steamapps/common (or common) prefix, drop trailing slashes. Shared by the DB
 * folder matchers (getDetectedGames, findGamesByInstallPaths). findSteamGame
 * keeps its own case-preserving variant (it existsSync-checks the real folder).
 */
export function normalizeInstalledFolder(installPath: string): string {
  let folder = installPath.toLowerCase();
  for (const marker of [
    'steamapps/common/',
    'steamapps\\common\\',
    'common/',
    'common\\',
  ]) {
    const idx = folder.indexOf(marker);
    if (idx !== -1) {
      folder = folder.slice(idx + marker.length);
      break;
    }
  }
  return folder.replace(/[\\/]+$/, '');
}
