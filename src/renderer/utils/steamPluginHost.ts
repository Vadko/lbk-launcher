import { t } from '@/shared/i18n/i18n';
import type {
  AchievementsBadge,
  MillenniumFailure,
  MillenniumInstallResult,
  MillenniumProgress,
  MillenniumUnsupportedReason,
} from '@/shared/plugin-host-types';

type HostOs = 'windows' | 'linux' | 'macos' | 'unknown';

let cachedOs: HostOs | null = null;

export function hostOs(): HostOs {
  if (cachedOs) {
    return cachedOs;
  }
  let platform: string | undefined;
  try {
    platform = window.electronAPI?.getPlatform?.();
  } catch {
    platform = undefined;
  }
  cachedOs =
    platform === 'windows' || platform === 'linux' || platform === 'macos'
      ? platform
      : 'unknown';
  return cachedOs;
}

function openSite(url: string, label: string): void {
  window.electronAPI?.openExternal?.(url).catch((error: unknown) => {
    console.warn(`[SteamPluginHost] Opening the ${label} site failed:`, error);
  });
}

export const openMillenniumSite = (): void =>
  openSite('https://steambrew.app', 'Millennium');
export const openDeckySite = (): void => openSite('https://decky.xyz', 'Decky Loader');

export function millenniumUnsupportedText(
  reason: MillenniumUnsupportedReason | null
): string {
  if (reason === null) {
    return t('millennium.unsupported.unknown');
  }
  if (reason === 'no-release' && hostOs() === 'macos') {
    return t('millennium.unsupported.noReleaseMac');
  }
  if (reason === 'steamos' || reason === 'decky-present') {
    return t('millennium.deckyHost');
  }
  return t(`millennium.unsupported.${reason}`);
}

export function millenniumFailureText(reason: MillenniumFailure | undefined): string {
  if (reason === undefined || reason === 'unsupported' || reason === 'restart-failed') {
    return t('millennium.failure.installFailed');
  }
  return t(`millennium.failure.${reason}`);
}

export function millenniumPhaseText(
  phase: MillenniumProgress['phase'],
  operation: 'install' | 'uninstall'
): string {
  return operation === 'uninstall' && phase === 'install-files'
    ? t('millennium.phase.uninstallFiles')
    : t(`millennium.phase.${phase}`);
}

export function achievementsBadgeDetail(badge: AchievementsBadge): string | null {
  if (badge.state === 'setting-off') {
    return t('achievementsBadge.settingOffDetail');
  }
  if (badge.state === 'unsupported') {
    return millenniumUnsupportedText(badge.unsupportedReason);
  }
  return null;
}

// Decided from the activation result: Steam may have been closed between prepare and activate.
export function activationOutcome(
  result: MillenniumInstallResult
): 'queued' | 'done-offline' | 'wait-plugin' {
  if (result.queued) {
    return 'queued';
  }
  return result.steamRunning === false ? 'done-offline' : 'wait-plugin';
}

// Steam may have started since the modal opened; when nothing is known, ask rather than restart it unasked.
export function steamRunningBeforeChange(
  fresh: boolean | undefined,
  cached: boolean | undefined
): boolean {
  return fresh ?? cached ?? true;
}
