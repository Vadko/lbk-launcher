import { getEglInstallDirs } from '@/main/game-detector/egl-linux';
import { getEpicManifestAppId } from '@/main/game-detector/epic';
import { addEglLaunchArgs } from '@/main/utils/egl-game-settings';
import { setEglWindowsLaunchArgs } from '@/main/utils/egl-windows-settings';
import { type LaunchCommand, parseLaunchCommand } from '@/main/utils/launch-command';
import { resolveGameDirToken } from '@/main/utils/launch-options-value';
import { isLinux, isWindows } from '@/main/utils/platform';
import { t } from '@/shared/i18n/i18n';
import type { Game, Platform } from '@/shared/types';

interface EglIntegrationTarget {
  platform: Platform;
  path: string;
}

interface EglIntegrationResult {
  launchOptionsError?: string;
  eglLaunchOptionsNotes?: string[];
}

function parseOptions(
  value: string,
  gameDir: string
): LaunchCommand | EglIntegrationResult {
  const resolved = resolveGameDirToken(value, gameDir);
  if (resolved.value === null) {
    console.warn('[Installer] EGL launch options:', resolved.reason);
    return { launchOptionsError: t('launchOptions.gameDirUnresolved') };
  }
  const options = parseLaunchCommand(resolved.value);
  if (!options) {
    console.warn('[Installer] EGL launch options need a shell, not applied:', value);
    return { launchOptionsError: t('launchOptions.eglNeedsShell') };
  }
  return options;
}

// EGLv2 re-reads its JSON before every launch, so it is written right away
function applyLinux(value: string, gameDir: string): EglIntegrationResult {
  const options = parseOptions(value, gameDir);
  if (!('args' in options)) {
    return options;
  }
  try {
    if (options.argsText && !addEglLaunchArgs(gameDir, options.argsText)) {
      return { launchOptionsError: t('launchOptions.eglWriteFailed') };
    }
  } catch (error) {
    console.warn('[Installer] EGL launch args failed:', error);
    return { launchOptionsError: t('launchOptions.eglWriteFailed') };
  }
  console.log('[Installer] EGL launch options applied:', value);
  return Object.keys(options.env).length > 0
    ? { eglLaunchOptionsNotes: [t('launchOptions.eglEnvOnlyFromLbk')] }
    : {};
}

async function applyWindows(
  value: string,
  gameDir: string,
  appId: string
): Promise<EglIntegrationResult> {
  const options = parseOptions(value, gameDir);
  if (!('args' in options)) {
    return options;
  }
  const result = options.argsText
    ? await setEglWindowsLaunchArgs(appId, options.argsText).catch((error: unknown) => {
        console.warn('[Installer] EGL launch args failed:', error);
        return 'failed' as const;
      })
    : 'written';
  console.log(`[Installer] EGL launch options ${result}:`, value);
  if (result === 'failed') {
    return { launchOptionsError: t('launchOptions.eglWriteFailed') };
  }
  // Windows has no Proton fallback, so env assignments reach the game from nowhere
  const notes = [
    ...(result === 'queued' ? [t('launchOptions.eglQueued')] : []),
    ...(Object.keys(options.env).length > 0
      ? [t('launchOptions.eglEnvUnsupported')]
      : []),
  ];
  return notes.length > 0 ? { eglLaunchOptionsNotes: notes } : {};
}

// The Epic Games Launcher counterpart of the Steam launch options: the args land in EGL's own per-game arguments
export function applyEglIntegration(
  game: Game,
  target: EglIntegrationTarget
): Promise<EglIntegrationResult> {
  if (target.platform !== 'epic') {
    return Promise.resolve({});
  }
  const windowsAppId =
    isWindows() && game.steam_launch_options_windows
      ? getEpicManifestAppId(target.path)
      : null;
  if (windowsAppId && game.steam_launch_options_windows) {
    return applyWindows(game.steam_launch_options_windows, target.path, windowsAppId);
  }
  if (isWindows() && game.steam_launch_options_windows) {
    console.warn('[Installer] No EGL manifest for launch options:', target.path);
  }
  if (
    isLinux() &&
    game.steam_launch_options_linux &&
    getEglInstallDirs().includes(target.path)
  ) {
    return Promise.resolve(applyLinux(game.steam_launch_options_linux, target.path));
  }
  return Promise.resolve({});
}
