import { getCurrentSteamAccountId } from '@/main/game-detector/steam';
import { checkInstallation } from '@/main/installer/cache';
import { queueSteamAction } from '@/main/steam-pending-actions';
import {
  type ApplyMode,
  applySteamArtwork,
  type RevertMode,
  removeSteamArtwork,
} from '@/main/utils/steam-artwork';
import {
  launchOptionsParamsFor,
  writeSteamLaunchOptions,
} from '@/main/utils/steam-launch-options';
import { t } from '@/shared/i18n/i18n';
import type { SteamArtworkChangeResult } from '@/shared/installer-api-types';
import type { Game, InstallationStatus, Platform } from '@/shared/types';

interface SteamIntegrationTarget {
  platform: Platform;
  path: string;
}

interface SteamIntegrationResult {
  launchOptionsQueued?: boolean;
  /** The write failed for a reason a restart won't fix; shown to the user. */
  launchOptionsError?: string;
}

/**
 * The Steam-only tail of an install: launch options, then Ukrainian library
 * artwork.
 *
 * Kept as one function because both install paths have to run all of it —
 * translations that ship their own installer return early from the main flow,
 * and each step added at the end of that flow was silently skipped for them.
 */
export async function applySteamIntegration(
  game: Game,
  target: SteamIntegrationTarget,
  installSteamArtwork: boolean,
  onStatus?: (status: InstallationStatus) => void
): Promise<SteamIntegrationResult> {
  if (target.platform !== 'steam' || !game.steam_app_id) {
    return {};
  }

  let launchOptionsQueued = false;
  let launchOptionsError: string | undefined;

  const launchOptions = launchOptionsParamsFor(game, target.path);
  if (launchOptions) {
    onStatus?.({
      message: t('installSteamIntegration.launchOptions'),
      phase: 'install',
    });

    // Reached after the files are copied and the install is already recorded,
    // so nothing here may turn a finished install into a failed one. It still
    // has to surface: without its launch options the translation runs unmodded,
    // and saying nothing would report that as a success.
    try {
      const result = await writeSteamLaunchOptions(launchOptions);
      console.log(
        `[Installer] Steam LaunchOptions mode=${result.mode}${result.reason ? ` — ${result.reason}` : ''}`
      );
      if (result.mode === 'needs-shutdown') {
        queueSteamAction({
          kind: 'launch-options',
          gameId: game.id,
          gameName: game.name,
          accountId: getCurrentSteamAccountId(),
          params: launchOptions,
          queuedAt: new Date().toISOString(),
        });
        launchOptionsQueued = true;
      }
      if (result.mode === 'failed' || result.mode === 'unresolved') {
        launchOptionsError = result.reason ?? t('common.unknownError');
      }
    } catch (error) {
      console.warn('[Installer] Steam launch options failed:', error);
      // Not queued: restarting Steam cannot fix a throw that had nothing to do
      // with Steam being up, and the restart force-kills the user's session.
      launchOptionsError =
        error instanceof Error ? error.message : t('common.unknownError');
    }
  }

  await applySteamArtworkChoice(game, game.steam_app_id, installSteamArtwork, onStatus);

  return { launchOptionsQueued, launchOptionsError };
}

type ArtworkOutcome = 'live' | 'after-steam-start' | 'failed';

const APPLY_OUTCOME: Record<ApplyMode, ArtworkOutcome> = {
  cef: 'live',
  file: 'after-steam-start',
  noop: 'failed',
};

const REVERT_OUTCOME: Record<RevertMode, ArtworkOutcome> = {
  none: 'live',
  cef: 'live',
  file: 'after-steam-start',
  failed: 'failed',
};

// Never throws: an install is never turned into a failure over artwork.
async function applySteamArtworkChoice(
  game: Game,
  appId: number,
  enabled: boolean,
  onStatus?: (status: InstallationStatus) => void
): Promise<ArtworkOutcome> {
  try {
    if (!enabled) {
      return REVERT_OUTCOME[await removeSteamArtwork(appId)];
    }
    if (!game.capsule_path && !game.banner_path && !game.logo_path) {
      return 'failed';
    }
    onStatus?.({
      message: t('installSteamIntegration.artwork'),
      phase: 'install',
    });
    const artwork = await applySteamArtwork({
      appId,
      capsulePath: game.capsule_path,
      bannerPath: game.banner_path,
      logoPath: game.logo_path,
      updatedAt: game.updated_at,
    });
    console.log(
      `[Installer] Steam artwork mode=${artwork.mode}${artwork.installed.length ? ` — ${artwork.installed.join(', ')}` : ''}${artwork.reason ? ` — ${artwork.reason}` : ''}`
    );
    return APPLY_OUTCOME[artwork.mode];
  } catch (artworkError) {
    console.warn('[Installer] Steam artwork failed:', artworkError);
    return 'failed';
  }
}

export async function setInstalledSteamArtwork(
  game: Game,
  enabled: boolean,
  onStatus?: (status: InstallationStatus) => void
): Promise<SteamArtworkChangeResult> {
  const info = await checkInstallation(game);
  if (!info) {
    return { success: false, error: t('uninstall.notInstalled') };
  }
  // Uninstall reverts artwork only for a Steam record, so none is applied for another.
  if (!game.steam_app_id || info.installedPlatform !== 'steam') {
    return { success: false, error: t('installSteamIntegration.artworkNotSteam') };
  }
  const outcome = await applySteamArtworkChoice(
    game,
    game.steam_app_id,
    enabled,
    onStatus
  );
  if (outcome === 'failed') {
    return { success: false, error: t('installSteamIntegration.artworkFailed') };
  }
  return { success: true, visibleAfterSteamStart: outcome === 'after-steam-start' };
}
