/**
 * Set per-app Steam LaunchOptions for the current user.
 *
 * Two paths, picked from Steam's current state — no queue, no defer:
 *
 *   - **Steam off** → write `localconfig.vdf` directly. Steam reads our value
 *     when it next starts. Editing the file while Steam runs is unsafe (Steam
 *     keeps an in-memory copy and rewrites the file on graceful exit) so this
 *     path is gated on Steam being down.
 *
 *   - **Steam on** → call `SteamClient.Apps.SetAppLaunchOptions(...)` over the
 *     Steam bridge (CEF debug port or the LBK Bridge Millennium plugin). Live
 *     update, no restart, works while Steam is open.
 *
 * If Steam is on but no bridge is reachable, the result is `needs-shutdown`
 * and the caller decides whether to queue the write for Steam's next exit.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { KeyV, KeyVRoot, KeyVSet, parse as vdfParse } from 'fast-vdf';
import { getLocalConfigPath } from '@/main/game-detector/steam';
import { writeFileAtomic } from '@/main/utils/atomic-write';
import {
  mergeLaunchOptions,
  resolveGameDirToken,
  usesGameDirToken,
} from '@/main/utils/launch-options-value';
import { forCurrentOS } from '@/main/utils/platform';
import { getSteamBridge } from '@/main/utils/steam-bridge';
import { isSteamRunning } from '@/main/utils/steam-launcher';
import type { Game } from '@/shared/types';

export interface WriteLaunchOptionsParams {
  appId: number;
  /** Value for Windows builds. */
  windowsOptions: string | null;
  /** Value for Linux Proton builds. */
  linuxOptions: string | null;
  /**
   * Value for macOS. Never falls back to the Linux one: the path inside the
   * game differs (`Contents/MacOS`), so the Linux value would point Steam at
   * something that isn't there — silently, since the game still launches.
   */
  macosOptions: string | null;
  /**
   * Where the game is installed, used to resolve `{GAME_DIR}`. Optional: values
   * without the token don't need it.
   */
  gamePath?: string | null;
}

type WriteLaunchOptionsMode =
  | 'noop' // nothing to write (no options for current OS, or already in place)
  | 'cef' // applied live through the Steam bridge (CDP or plugin); name kept for logs
  | 'file' // wrote localconfig.vdf directly (Steam was off)
  | 'needs-shutdown' // Steam running + no bridge — caller queues or prompts a restart.
  | 'unresolved' // options needed a value we could not supply (unknown game
  //                 folder, or an unquoted token)
  | 'failed'; // tried to write and could not. Both are kept apart from 'noop'
//               so a write that never happened is never read as success.

interface WriteLaunchOptionsResult {
  mode: WriteLaunchOptionsMode;
  reason?: string;
}

function pickOptionsForCurrentOS(params: WriteLaunchOptionsParams): string | null {
  return forCurrentOS({
    windows: params.windowsOptions,
    macos: params.macosOptions,
    linux: params.linuxOptions,
  });
}

/** Fields of a translation record this module reads. */
type LaunchOptionsSource = Pick<
  Game,
  | 'steam_app_id'
  | 'steam_launch_options_windows'
  | 'steam_launch_options_linux'
  | 'steam_launch_options_macos'
>;

/**
 * Build the write params from a translation record. Callers used to assemble
 * these by hand in two places, so adding a field meant editing both — and a
 * missed site degrades to a silent noop rather than a compile error.
 *
 * Returns null when this translation configures no launch options at all.
 */
export function launchOptionsParamsFor(
  game: LaunchOptionsSource,
  gamePath: string | null
): WriteLaunchOptionsParams | null {
  if (
    !game.steam_app_id ||
    !(
      game.steam_launch_options_windows ||
      game.steam_launch_options_linux ||
      game.steam_launch_options_macos
    )
  ) {
    return null;
  }

  return {
    appId: game.steam_app_id,
    windowsOptions: game.steam_launch_options_windows,
    linuxOptions: game.steam_launch_options_linux,
    macosOptions: game.steam_launch_options_macos,
    gamePath,
  };
}

/**
 * True when the value this OS will actually use needs the game folder resolved.
 * Checks one column, not both: looking up the install path is expensive, and
 * the other platform's value is never written here.
 */
export function needsGameDir(game: LaunchOptionsSource): boolean {
  return usesGameDirToken(
    forCurrentOS({
      windows: game.steam_launch_options_windows,
      macos: game.steam_launch_options_macos,
      linux: game.steam_launch_options_linux,
    })
  );
}

const LAUNCH_OPTIONS_PARENT = [
  'UserLocalConfigStore',
  'Software',
  'Valve',
  'Steam',
  'apps',
];

/** Read a string pair value walking a path of nested sets; returns null on any miss. */
function readNestedPairValue(
  root: KeyVRoot,
  segments: string[],
  pairKey: string
): string | null {
  let cursor: KeyVSet | KeyVRoot = root;
  for (const seg of segments) {
    const next: KeyVSet | null = cursor.dir(seg, null);
    if (!next) {
      return null;
    }
    cursor = next;
  }
  const pair: KeyV | null = cursor.pair(pairKey, null);
  return pair ? String(pair.value) : null;
}

/** Walk down `segments`, creating empty `KeyVSet` nodes for any missing rungs. */
function ensurePath(root: KeyVRoot, segments: string[]): KeyVSet {
  let cursor: KeyVSet | KeyVRoot = root;
  for (const seg of segments) {
    const existing: KeyVSet | null = cursor.dir(seg, null);
    if (existing) {
      cursor = existing;
    } else {
      const fresh = new KeyVSet(seg);
      cursor.add(fresh);
      cursor = fresh;
    }
  }
  return cursor as KeyVSet;
}

interface MergePlan {
  root: KeyVRoot;
  existing: string | null;
  merged: string;
}

/** Parse the localconfig file once and compute the merged LaunchOptions value. */
function readAndPlanMerge(
  localConfigPath: string,
  appId: string,
  value: string
): MergePlan {
  const raw = fs.readFileSync(localConfigPath, 'utf8');
  const root = vdfParse(raw);
  const existing = readNestedPairValue(
    root,
    [...LAUNCH_OPTIONS_PARENT, appId],
    'LaunchOptions'
  );
  const merged = mergeLaunchOptions(existing, value);
  return { root, existing, merged };
}

/** Splice merged value into the parsed tree and write back atomically. */
function writeMergedToLocalConfig(
  localConfigPath: string,
  plan: MergePlan,
  appIdStr: string
): void {
  const app = ensurePath(plan.root, [...LAUNCH_OPTIONS_PARENT, appIdStr]);
  const existingPair: KeyV | null = app.pair('LaunchOptions', null);
  if (existingPair) {
    existingPair.value = plan.merged;
  } else {
    app.add(new KeyV('LaunchOptions', plan.merged));
  }

  // A truncating write that crashes would wipe the user's whole Steam config.
  writeFileAtomic(localConfigPath, plan.root.dump());
}

/**
 * Apply the requested LaunchOptions value for `params.appId`, choosing the bridge
 * or the file based on Steam's current state. See module docstring for details.
 */
export async function writeSteamLaunchOptions(
  params: WriteLaunchOptionsParams
): Promise<WriteLaunchOptionsResult> {
  // Trimmed once, here: the idempotency checks downstream compare against a
  // trimmed existing value, so stray whitespace from the admin form would make
  // every re-install look like a new value and append a duplicate.
  const configured = pickOptionsForCurrentOS(params)?.trim();
  if (!configured) {
    return { mode: 'noop', reason: 'No launch options for current OS' };
  }

  const resolution = resolveGameDirToken(configured, params.gamePath ?? null);
  if (resolution.value === null) {
    return { mode: 'unresolved', reason: resolution.reason };
  }
  const value = resolution.value;

  const localConfigPath = getLocalConfigPath();
  if (!localConfigPath || !fs.existsSync(localConfigPath)) {
    return {
      mode: 'failed',
      reason: 'localconfig.vdf not found — Steam never started?',
    };
  }

  const appIdStr = String(params.appId);
  let plan: MergePlan;
  try {
    plan = readAndPlanMerge(localConfigPath, appIdStr, value);
  } catch (error) {
    return {
      mode: 'failed',
      reason: error instanceof Error ? error.message : 'Unknown error',
    };
  }

  if (plan.merged === (plan.existing ?? '').trim()) {
    console.log(
      `[SteamLaunchOptions] App ${params.appId} already contains our LaunchOptions — nothing to do`
    );
    return { mode: 'noop', reason: 'LaunchOptions already include our value' };
  }

  // Steam off → file is safe to edit directly; there is no bridge to talk to anyway.
  if (!(await isSteamRunning())) {
    try {
      writeMergedToLocalConfig(localConfigPath, plan, appIdStr);
      console.log(
        `[SteamLaunchOptions] App ${params.appId} wrote ${path.basename(localConfigPath)} (Steam off)`
      );
      return { mode: 'file' };
    } catch (error) {
      return {
        mode: 'failed',
        reason: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // Steam on → only the bridge is safe. getSteamBridge() honours the setting mid-session:
  // the CEF port stays open until Steam restarts even after the flag file is deleted.
  const bridge = await getSteamBridge();
  if (bridge) {
    try {
      await bridge.invoke('setLaunchOptions', {
        appId: params.appId,
        value: plan.merged,
      });
      console.log(
        `[SteamLaunchOptions] App ${params.appId} updated live via ${bridge.transport}`
      );
      return { mode: 'cef', reason: `via ${bridge.transport}` };
    } catch (error) {
      return {
        mode: 'failed',
        reason: error instanceof Error ? error.message : 'Steam bridge apply failed',
      };
    }
  }

  // Editing localconfig.vdf now is unsafe (Steam overwrites it on exit).
  return {
    mode: 'needs-shutdown',
    reason: 'Steam running without a bridge — restart required to apply',
  };
}
