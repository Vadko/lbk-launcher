import {
  type ApplyMode,
  type ArtworkTarget,
  applySteamArtwork,
  type RevertMode,
  removeSteamArtwork,
} from '@/main/utils/steam-artwork';
import { t } from '@/shared/i18n/i18n';
import type { Game, InstallationStatus } from '@/shared/types';

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
export async function applySteamArtworkChoice(
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
