import { applySteamArtworkChoice } from '@/main/installer/steam-artwork-choice';
import type {
  SteamIntegrationResult,
  SteamIntegrationTarget,
} from '@/main/installer/steam-integration';
import { artworkTargetForGame, writeBottleLaunchOptions } from '@/main/wine/bottle-steam';
import type { BottleSteam } from '@/main/wine/bottle-steam-roots';
import { errorMessage } from '@/shared/errors';
import { t } from '@/shared/i18n/i18n';
import { offersSteamArtwork } from '@/shared/offers-steam-artwork';
import type { Game, InstallationStatus } from '@/shared/types';

// The bottle's Steam has no bridge, so its files are written while it is closed, or once it exits
export async function applyBottleSteamIntegration(
  game: Game,
  bottle: BottleSteam,
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
