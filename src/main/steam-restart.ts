import * as fs from 'node:fs';
import { getFirstAvailableGamePath } from '@/main/game-detector';
import { getCurrentSteamAccountId } from '@/main/game-detector/steam';
import { checkInstallation } from '@/main/installer/cache';
import {
  getPendingSteamActions,
  pauseSteamMonitor,
  queueSteamAction,
  runPendingSteamActions,
} from '@/main/steam-pending-actions';
import { setCefDebuggingEnabled } from '@/main/utils/cef-flag-file';
import { verifyBridgeAfterLaunch } from '@/main/utils/steam-bridge';
import { launchOptionsParamsFor, needsGameDir } from '@/main/utils/steam-launch-options';
import { restartSteamProcess } from '@/main/utils/steam-launcher';
import { waitForSteamStart } from '@/main/utils/steam-process';
import { isCefDebuggingEnabledInSettings } from '@/main/utils/store-storage';
import type {
  ApplyPendingLaunchOptionsResult,
  RestartSteamResult,
} from '@/shared/plugin-host-types';
import type { Game } from '@/shared/types';

interface GapOutcome {
  appliedGameIds: string[];
  failed: { gameId: string; reason: string }[];
}

interface OrchestratedRestart {
  result: RestartSteamResult;
  gap: GapOutcome;
}

const STEAM_START_TIMEOUT_MS = 30000;

async function runGapWork(gap: GapOutcome): Promise<void> {
  try {
    const applied = await runPendingSteamActions('restart-gap');
    gap.appliedGameIds = applied.appliedGameIds;
    gap.failed = applied.failed;
  } catch (error) {
    console.warn('[PendingActions] Restart-gap queue run failed:', error);
  }
  if (isCefDebuggingEnabledInSettings()) {
    try {
      // Steam is off, so a missing flag file can be restored before it starts again.
      await setCefDebuggingEnabled(true, { prompt: false });
    } catch (error) {
      console.warn('[SteamBridge] Re-ensuring the CEF flag file failed:', error);
    }
  }
}

async function orchestrate(verifyBridge: boolean): Promise<OrchestratedRestart> {
  const gap: GapOutcome = { appliedGameIds: [], failed: [] };
  const resume = pauseSteamMonitor();
  let result: RestartSteamResult;
  try {
    result = await restartSteamProcess({ beforeLaunch: () => runGapWork(gap) });
    if (!result.success) {
      return { result, gap };
    }
    if (!(await waitForSteamStart(STEAM_START_TIMEOUT_MS))) {
      console.warn('[Steam] Steam did not come back after the restart');
      // The renderer's launch-failed copy ("start Steam yourself") is what fits here.
      return {
        result: { success: false, reason: 'launch-failed', error: 'Steam не запустився' },
        gap,
      };
    }
  } finally {
    resume();
  }

  if (verifyBridge) {
    result = { ...result, bridge: await verifyBridgeAfterLaunch('lbk-restart') };
  } else {
    verifyBridgeAfterLaunch('lbk-restart').catch((error) => {
      console.warn('[SteamBridge] Background verification failed:', error);
    });
  }
  return { result, gap };
}

let inFlight: Promise<OrchestratedRestart> | null = null;

function orchestrateOnce(verifyBridge: boolean): Promise<OrchestratedRestart> {
  if (!inFlight) {
    inFlight = orchestrate(verifyBridge).finally(() => {
      inFlight = null;
    });
  }
  return inFlight;
}

export async function restartSteamOrchestrated(opts: {
  verifyBridge: boolean;
}): Promise<RestartSteamResult> {
  return (await orchestrateOnce(opts.verifyBridge)).result;
}

function isQueuedFor(gameId: string): boolean {
  return getPendingSteamActions().some(
    (a) => a.kind === 'launch-options' && a.gameId === gameId
  );
}

export async function applyLaunchOptionsNow(
  game: Game
): Promise<ApplyPendingLaunchOptionsResult> {
  if (!game.steam_app_id) {
    return { success: false, error: 'Гра не має Steam App ID' };
  }

  // The lookup walks Steam's library folders and rewrites the install cache, so it only runs for {GAME_DIR}.
  const needsDir = needsGameDir(game);
  const installInfo = needsDir ? await checkInstallation(game) : null;

  // The recorded path goes stale when the game moves to another Steam library.
  const detected = needsDir
    ? getFirstAvailableGamePath(game.install_paths || [], game.steam_app_id)
    : null;
  const recordedPath = installInfo?.gamePath ?? null;

  let gamePath: string | null = null;
  if (detected?.exists && detected.path) {
    gamePath = detected.path;
  } else if (recordedPath && fs.existsSync(recordedPath)) {
    gamePath = recordedPath;
  }

  const params = launchOptionsParamsFor(game, gamePath);
  if (!params) {
    return { success: false, error: 'Для цього перекладу не задано параметрів запуску' };
  }
  // Knowable before Steam goes down; no point killing the user's session for a write that cannot land.
  if (needsDir && !params.gamePath) {
    return {
      success: false,
      error: 'Не вдалося визначити теку гри для параметрів запуску',
    };
  }

  queueSteamAction({
    kind: 'launch-options',
    gameId: game.id,
    gameName: game.name,
    accountId: getCurrentSteamAccountId(),
    params,
    queuedAt: new Date().toISOString(),
  });

  // Steam off or a bridge already up writes it without a restart.
  const direct = await runPendingSteamActions('manual');
  if (direct.appliedGameIds.includes(game.id)) {
    return { success: true };
  }
  const directFailure = direct.failed.find((f) => f.gameId === game.id);
  if (directFailure) {
    return { success: false, error: directFailure.reason };
  }
  // Dropped as stale (game no longer installed); restarting Steam would change nothing.
  if (!isQueuedFor(game.id)) {
    return { success: false, error: 'Не вдалося записати параметри запуску' };
  }

  const { result, gap } = await orchestrateOnce(false);
  if (!result.success) {
    return {
      success: false,
      reason: result.reason,
      queued: isQueuedFor(game.id),
      error: result.error,
    };
  }
  if (gap.appliedGameIds.includes(game.id)) {
    return { success: true };
  }
  const gapFailure = gap.failed.find((f) => f.gameId === game.id);
  if (gapFailure) {
    return { success: false, error: gapFailure.reason };
  }
  return {
    success: false,
    queued: isQueuedFor(game.id),
    error: 'Не вдалося записати параметри запуску',
  };
}
