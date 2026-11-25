import { A, D, F } from '@mobily/ts-belt';
import { isEglInstall, isEglPreviewInstalled } from '@/main/game-detector/egl-v2';
import { getEpicManifestAppId } from '@/main/game-detector/epic';
import { addEglLaunchArgs } from '@/main/utils/egl-game-settings';
import {
  type EglLaunchArgsResult,
  setEglWindowsLaunchArgs,
} from '@/main/utils/egl-windows-settings';
import { type LaunchCommand, parseLaunchCommand } from '@/main/utils/launch-command';
import { resolveGameDirToken } from '@/main/utils/launch-options-value';
import { isLinux, isWindows } from '@/main/utils/platform';
import { t } from '@/shared/i18n/i18n';
import type { Game, Platform } from '@/shared/types';
import type { WinePrefixRef } from '@/shared/wine-types';

interface EglIntegrationTarget {
  platform: Platform;
  path: string;
  wine?: WinePrefixRef;
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

// EGLv2 re-reads its JSON before every launch, on Linux and on Windows alike, so it is written right away
function applyEglV2(
  value: string,
  gameDir: string,
  envNote: 'launchOptions.eglEnvOnlyFromLbk' | 'launchOptions.eglEnvUnsupported'
): EglIntegrationResult {
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
  return D.isNotEmpty(options.env) ? { eglLaunchOptionsNotes: [t(envNote)] } : {};
}

function eglV1Result(
  result: EglLaunchArgsResult,
  options: LaunchCommand,
  value: string
): EglIntegrationResult {
  console.log(`[Installer] EGL launch options ${result}:`, value);
  if (result === 'failed') {
    return { launchOptionsError: t('launchOptions.eglWriteFailed') };
  }
  // Windows has no Proton fallback, so env assignments reach the game from nowhere
  const notes = A.concat(
    result === 'queued' ? [t('launchOptions.eglQueued')] : [],
    D.isNotEmpty(options.env) ? [t('launchOptions.eglEnvUnsupported')] : []
  );
  return A.isNotEmpty(notes) ? { eglLaunchOptionsNotes: F.toMutable(notes) } : {};
}

// The Epic Games Launcher counterpart of the Steam launch options: the args land in EGL's own per-game arguments
export async function applyEglIntegration(
  game: Game,
  target: EglIntegrationTarget
): Promise<EglIntegrationResult> {
  if (target.platform !== 'epic') {
    return {};
  }
  // The EGL in a CrossOver bottle keeps its settings inside the bottle, which LBK does not edit
  if (target.wine) {
    return game.steam_launch_options_windows?.trim()
      ? { launchOptionsError: t('launchOptions.eglInWine') }
      : {};
  }
  const windowsOptions = isWindows() ? game.steam_launch_options_windows : null;
  if (windowsOptions) {
    const v1AppId = getEpicManifestAppId(target.path);
    // The installed preview handles the links over EGL v1; a log it left behind does not
    if (isEglInstall(target.path) && (!v1AppId || isEglPreviewInstalled())) {
      return applyEglV2(windowsOptions, target.path, 'launchOptions.eglEnvUnsupported');
    }
    if (!v1AppId) {
      return notInEgl(target.path);
    }
    const options = parseOptions(windowsOptions, target.path);
    if (!('args' in options)) {
      return options;
    }
    const result = options.argsText
      ? await setEglWindowsLaunchArgs(v1AppId, options.argsText).catch(
          (error: unknown) => {
            console.warn('[Installer] EGL launch args failed:', error);
            return 'failed' as const;
          }
        )
      : 'written';
    return eglV1Result(result, options, windowsOptions);
  }
  const linuxOptions = isLinux() ? game.steam_launch_options_linux : null;
  if (linuxOptions) {
    // A Heroic or Lutris install has no EGL settings for the args to go into
    return isEglInstall(target.path)
      ? applyEglV2(linuxOptions, target.path, 'launchOptions.eglEnvOnlyFromLbk')
      : notInEgl(target.path);
  }
  return {};
}

// Without its launch options the translation runs unmodded, so the install says so
function notInEgl(gameDir: string): EglIntegrationResult {
  console.warn('[Installer] No EGL install to take the launch options:', gameDir);
  return { launchOptionsError: t('launchOptions.eglGameNotFound') };
}
