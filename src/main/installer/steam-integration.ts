import { getCurrentSteamAccountId } from '@/main/game-detector/steam';
import { queueSteamAction } from '@/main/steam-pending-actions';
import { applySteamArtwork } from '@/main/utils/steam-artwork';
import {
  launchOptionsParamsFor,
  writeSteamLaunchOptions,
} from '@/main/utils/steam-launch-options';
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
      message: 'Налаштування параметрів запуску Steam...',
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
        launchOptionsError = result.reason ?? 'Невідома помилка';
      }
    } catch (error) {
      console.warn('[Installer] Steam launch options failed:', error);
      // Not queued: restarting Steam cannot fix a throw that had nothing to do
      // with Steam being up, and the restart force-kills the user's session.
      launchOptionsError = error instanceof Error ? error.message : 'Невідома помилка';
    }
  }

  // Never fail an install over artwork.
  if (game.capsule_path || game.banner_path || game.logo_path) {
    onStatus?.({
      message: 'Встановлення українських обкладинок Steam...',
      phase: 'install',
    });
    try {
      const artwork = await applySteamArtwork({
        appId: game.steam_app_id,
        capsulePath: game.capsule_path,
        bannerPath: game.banner_path,
        logoPath: game.logo_path,
        updatedAt: game.updated_at,
      });
      console.log(
        `[Installer] Steam artwork mode=${artwork.mode}${artwork.installed.length ? ` — ${artwork.installed.join(', ')}` : ''}${artwork.reason ? ` — ${artwork.reason}` : ''}`
      );
    } catch (artworkError) {
      console.warn('[Installer] Steam artwork failed:', artworkError);
    }
  }

  return { launchOptionsQueued, launchOptionsError };
}
