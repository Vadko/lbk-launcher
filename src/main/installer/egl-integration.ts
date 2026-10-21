import { getEglInstallDirs } from '@/main/game-detector/egl-linux';
import { addEglLaunchArgs } from '@/main/utils/egl-game-settings';
import { parseLaunchCommand } from '@/main/utils/launch-command';
import { resolveGameDirToken } from '@/main/utils/launch-options-value';
import { t } from '@/shared/i18n/i18n';
import type { Game, Platform } from '@/shared/types';

interface EglIntegrationTarget {
  platform: Platform;
  path: string;
}

// The EGLv2 counterpart of the Steam launch options: the args land in EGL's own per-game arguments
export function applyEglIntegration(
  game: Game,
  target: EglIntegrationTarget
): { launchOptionsError?: string } {
  const value = game.steam_launch_options_linux;
  if (
    target.platform !== 'epic' ||
    !value ||
    !getEglInstallDirs().includes(target.path)
  ) {
    return {};
  }
  const resolved = resolveGameDirToken(value, target.path);
  if (resolved.value === null) {
    console.warn('[Installer] EGL launch options:', resolved.reason);
    return { launchOptionsError: t('launchOptions.gameDirUnresolved') };
  }
  const options = parseLaunchCommand(resolved.value);
  if (!options) {
    console.warn('[Installer] EGL launch options need a shell, not applied:', value);
    return { launchOptionsError: t('launchOptions.eglNeedsShell') };
  }
  try {
    if (options.argsText && !addEglLaunchArgs(target.path, options.argsText)) {
      return { launchOptionsError: t('launchOptions.eglWriteFailed') };
    }
  } catch (error) {
    console.warn('[Installer] EGL launch args failed:', error);
    return { launchOptionsError: t('launchOptions.eglWriteFailed') };
  }
  console.log('[Installer] EGL launch options applied:', value);
  return Object.keys(options.env).length > 0
    ? { launchOptionsError: t('launchOptions.eglEnvOnlyFromLbk') }
    : {};
}
