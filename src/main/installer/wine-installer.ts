import { clipboard } from 'electron';
import path from 'path';
import { t } from '@/shared/i18n/i18n';
import type { InstallationStatus } from '../../shared/types';
import type { WinePrefixRef } from '../../shared/wine-types';
import { hostToWinePath } from '../wine/dos-path';
import { hasWineRunner, runInWine } from '../wine/run';

export async function runInstallerInWine(
  wine: WinePrefixRef,
  installerPath: string,
  onStatus?: (status: InstallationStatus) => void
): Promise<void> {
  // The game folder as the prefix sees it, so an installer that asks for its folder can take it from the clipboard
  const installPath = hostToWinePath(wine.prefix, path.dirname(installerPath));
  if (!hasWineRunner(wine) || installPath === null) {
    throw new Error(t('installPlatform.wineMissing', { bottle: wine.label }));
  }
  await clipboard
    .writeText(installPath)
    .catch((error) => console.warn('[Installer] Failed to copy install path:', error));
  onStatus?.({
    message: t('installPlatform.wineSetup', { bottle: wine.label }),
    phase: 'install',
  });
  const exitCode = await runInWine(wine, installerPath, [
    `/installpath=${installPath}`,
    `/DIR=${installPath}`,
    `/INSTALLDIR=${installPath}`,
  ]);
  if (exitCode !== null && exitCode !== 0) {
    throw new Error(t('installPlatform.exitCode', { code: exitCode }));
  }
}

export async function runUninstallerInWine(
  wine: WinePrefixRef,
  uninstallerPath: string
): Promise<void> {
  const exitCode = await runInWine(wine, uninstallerPath, [
    '/uninstall',
    '/SILENT',
    '/silent',
  ]);
  console.log(`[Uninstaller] Uninstaller exited with code: ${exitCode}`);
}
