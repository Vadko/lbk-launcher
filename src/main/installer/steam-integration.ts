import { getCurrentSteamAccountId } from '@/main/game-detector/steam';
import type { SteamRoot } from '@/main/game-detector/steam-roots';
import { checkInstallation } from '@/main/installer/cache';
import { rewriteInstallationRecord } from '@/main/installer/installation-info';
import { queueSteamAction } from '@/main/steam-pending-actions';
import {
  type ApplyMode,
  type ArtworkTarget,
  applySteamArtwork,
  type RevertMode,
  removeSteamArtwork,
} from '@/main/utils/steam-artwork';
import {
  launchOptionsParamsFor,
  writeSteamLaunchOptions,
} from '@/main/utils/steam-launch-options';
import {
  artworkTargetForGame,
  bottleSteamRootOf,
  writeBottleLaunchOptions,
} from '@/main/wine/bottle-steam';
import { errorMessage } from '@/shared/errors';
import { t } from '@/shared/i18n/i18n';
import type { SteamArtworkChangeResult } from '@/shared/installer-api-types';
import { offersSteamArtwork } from '@/shared/offers-steam-artwork';
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

  const bottle = bottleSteamRootOf(target.path);
  if (bottle) {
    return applyBottleSteamIntegration(
      game,
      bottle,
      target,
      installSteamArtwork,
      onStatus
    );
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

  // A game that stopped offering artwork loses what was applied; its record keeps the player's choice.
  await applySteamArtworkChoice(
    game,
    game.steam_app_id,
    installSteamArtwork && offersSteamArtwork(game, target.platform),
    onStatus
  );

  return { launchOptionsQueued, launchOptionsError };
}

// The bottle's Steam has no bridge, so its files are written while it is closed, or once it exits
async function applyBottleSteamIntegration(
  game: Game,
  bottle: SteamRoot,
  target: SteamIntegrationTarget,
  installSteamArtwork: boolean,
  onStatus?: (status: InstallationStatus) => void
): Promise<SteamIntegrationResult> {
  if (!game.steam_app_id) {
    return {};
  }
  if (game.steam_launch_options_windows?.trim()) {
    onStatus?.({ message: t('installSteamIntegration.launchOptions'), phase: 'install' });
  }
  const launchOptions = await writeBottleLaunchOptions(game, bottle, target.path).catch(
    (error: unknown) => ({ mode: 'failed' as const, reason: errorMessage(error) })
  );
  console.log(`[Installer] Bottle Steam LaunchOptions mode=${launchOptions.mode}`);
  await applySteamArtworkChoice(
    game,
    game.steam_app_id,
    installSteamArtwork && offersSteamArtwork(game, target.platform),
    onStatus,
    artworkTargetForGame(target.path)
  );
  return {
    launchOptionsQueued: launchOptions.mode === 'queued',
    launchOptionsError:
      launchOptions.mode === 'failed' ? launchOptions.reason : undefined,
  };
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
  onStatus?: (status: InstallationStatus) => void,
  target?: ArtworkTarget
): Promise<ArtworkOutcome> {
  try {
    if (!enabled) {
      return REVERT_OUTCOME[await removeSteamArtwork(appId, target)];
    }
    onStatus?.({
      message: t('installSteamIntegration.artwork'),
      phase: 'install',
    });
    const artwork = await applySteamArtwork(
      {
        appId,
        capsulePath: game.capsule_path,
        bannerPath: game.banner_path,
        logoPath: game.logo_path,
        updatedAt: game.updated_at,
      },
      target
    );
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
  if (enabled && !offersSteamArtwork(game, info.installedPlatform)) {
    return { success: false, error: t('installSteamIntegration.artworkFailed') };
  }
  const outcome = await applySteamArtworkChoice(
    game,
    game.steam_app_id,
    enabled,
    onStatus,
    artworkTargetForGame(info.gamePath)
  );
  if (outcome === 'failed') {
    return { success: false, error: t('installSteamIntegration.artworkFailed') };
  }
  await rewriteInstallationRecord(info, (record) => ({
    ...record,
    steamArtwork: enabled,
  })).catch((error: unknown) => {
    console.warn('[Installer] Recording the artwork choice failed:', error);
  });
  return { success: true, visibleAfterSteamStart: outcome === 'after-steam-start' };
}
