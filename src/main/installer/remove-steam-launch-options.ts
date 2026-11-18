import { getCurrentSteamAccountId } from '@/main/game-detector/steam';
import { queueSteamAction } from '@/main/steam-pending-actions';
import {
  clearSteamLaunchOptions,
  launchOptionsParamsFor,
} from '@/main/utils/steam-launch-options';
import { bottleSteamOf } from '@/main/wine/bottle-steam-roots';
import type { Game } from '@/shared/types';

// A wrapper left behind points Steam at files the uninstall just removed, and the game no longer starts.
export async function removeSteamLaunchOptions(
  game: Game,
  gamePath: string
): Promise<void> {
  const params = launchOptionsParamsFor(game, gamePath);
  if (!params || bottleSteamOf(gamePath)) {
    return;
  }
  try {
    const result = await clearSteamLaunchOptions(params);
    console.log(
      `[Uninstall] Steam LaunchOptions removal mode=${result.mode}${result.reason ? ` — ${result.reason}` : ''}`
    );
    if (result.mode === 'needs-shutdown') {
      queueSteamAction({
        kind: 'launch-options',
        gameId: game.id,
        gameName: game.name,
        accountId: getCurrentSteamAccountId(),
        params,
        remove: true,
        queuedAt: new Date().toISOString(),
      });
    }
  } catch (error) {
    console.warn('[Uninstall] Could not remove Steam launch options:', error);
  }
}
