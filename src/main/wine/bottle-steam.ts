import { execFile } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { promisify } from 'node:util';
import pLimit from 'p-limit';
import pWaitFor from 'p-wait-for';
import { z } from 'zod';
import { getSteamRoots, getSteamUserConfigPath } from '@/main/game-detector/steam';
import type { SteamRoot } from '@/main/game-detector/steam-roots';
import { isPathInside } from '@/main/utils/fs-safe';
import { resolveGameDirToken } from '@/main/utils/launch-options-value';
import { type ArtworkTarget, prefixArtworkTarget } from '@/main/utils/steam-artwork';
import { mergeLaunchOptionsIntoFile } from '@/main/utils/steam-launch-options';
import {
  deleteStoreValue,
  readStoreValue,
  writeStoreValue,
} from '@/main/utils/store-storage';
import { errnoCode, errorMessage } from '@/shared/errors';
import type { Game } from '@/shared/types';
import type { WinePrefixRef } from '@/shared/wine-types';
import { hostToWinePath } from './dos-path';
import { startInWine } from './run';

const execFileAsync = promisify(execFile);

const PENDING_KEY = 'pending-wine-launch-options';
const POLL_MS = 15000;

/** The Steam of the Wine prefix a game folder lies in. */
export function bottleSteamRootOf(gamePath: string): SteamRoot | null {
  return (
    getSteamRoots().find(
      (root) => root.prefix !== null && isPathInside(root.prefix, gamePath)
    ) ?? null
  );
}

function bottleArtworkTarget(root: SteamRoot): ArtworkTarget {
  return prefixArtworkTarget(
    root.prefix ?? root.steamPath,
    getSteamUserConfigPath(root.steamPath, 'grid')
  );
}

/** The grid of the Steam a game copy belongs to; undefined for the native Steam. */
export function artworkTargetForGame(gamePath: string): ArtworkTarget | undefined {
  const root = bottleSteamRootOf(gamePath);
  return root ? bottleArtworkTarget(root) : undefined;
}

/** Asks the bottle's Steam to start the game, starting that Steam first when it is closed. */
export function launchInBottleSteam(
  prefix: WinePrefixRef,
  gamePath: string,
  appId: number
): boolean {
  const root = bottleSteamRootOf(gamePath);
  const steamExe = root
    ? fs.readdirSync(root.steamPath).find((entry) => entry.toLowerCase() === 'steam.exe')
    : undefined;
  if (!root || !steamExe) {
    console.warn(`[Wine] No Steam for ${gamePath}`);
    return false;
  }
  return startInWine(prefix, path.join(root.steamPath, steamExe), [
    '-applaunch',
    String(appId),
  ]);
}

// Wine replaces a program's argv on macOS, so the bottle shows only through the working folder Steam runs in
async function isBottleSteamRunning(root: SteamRoot): Promise<boolean> {
  const prefix = root.prefix;
  if (prefix === null) {
    return true;
  }
  try {
    const { stdout } = await execFileAsync(
      '/usr/sbin/lsof',
      ['-a', '-c', 'steam.exe', '-d', 'cwd', '-Fn'],
      { timeout: 10000 }
    );
    return stdout
      .split('\n')
      .some((line) => line.startsWith('n') && isPathInside(prefix, line.slice(1)));
  } catch (error) {
    // lsof exits 1 with no output when no such process runs; anything else counts as running
    return errnoCode(error) !== 1;
  }
}

const pendingSchema = z.array(
  z.object({
    prefix: z.string(),
    steamPath: z.string(),
    appId: z.number(),
    value: z.string(),
  })
);

type PendingLaunchOptions = z.infer<typeof pendingSchema>[number];

function readPending(): PendingLaunchOptions[] {
  const parsed = pendingSchema.safeParse(readStoreValue(PENDING_KEY));
  return parsed.success ? parsed.data : [];
}

function writePending(pending: PendingLaunchOptions[]): void {
  if (pending.length === 0) {
    deleteStoreValue(PENDING_KEY);
    return;
  }
  writeStoreValue(PENDING_KEY, pending);
}

const edits = pLimit(1);
const watcher: { running?: Promise<unknown> } = {};

function writeToBottle(entry: PendingLaunchOptions): void {
  const file = getSteamUserConfigPath(entry.steamPath, 'localconfig.vdf');
  if (!file || !fs.existsSync(file)) {
    throw new Error('localconfig.vdf not found — Steam never started in this bottle?');
  }
  const outcome = mergeLaunchOptionsIntoFile(file, entry.appId, entry.value);
  console.log(`[Wine] Launch options of ${entry.appId} in ${entry.prefix}: ${outcome}`);
}

async function flushPending(): Promise<boolean> {
  const pending = readPending();
  const kept: PendingLaunchOptions[] = [];
  for (const entry of pending) {
    const root = { steamPath: entry.steamPath, prefix: entry.prefix };
    if (!fs.existsSync(entry.steamPath)) {
      continue;
    }
    if (await isBottleSteamRunning(root)) {
      kept.push(entry);
      continue;
    }
    try {
      writeToBottle(entry);
    } catch (error) {
      console.warn('[Wine] Queued launch options dropped:', error);
    }
  }
  writePending(kept);
  return kept.length === 0;
}

function watchBottleSteamExit(): void {
  watcher.running ??= pWaitFor(() => edits(flushPending), { interval: POLL_MS })
    .catch((error: unknown) => {
      console.warn('[Wine] Launch options queue stopped:', error);
    })
    .finally(() => {
      watcher.running = undefined;
    });
}

// Options queued before LBK last quit still wait for the bottle's Steam to exit
export function startPendingWineLaunchOptions(): void {
  if (readPending().length > 0) {
    watchBottleSteamExit();
  }
}

export type BottleLaunchOptionsResult =
  | { mode: 'noop' | 'file' | 'queued' }
  | { mode: 'failed'; reason: string };

/** The Windows launch options go into the bottle Steam's localconfig.vdf, now or once that Steam exits. */
export function writeBottleLaunchOptions(
  game: Pick<Game, 'steam_app_id' | 'steam_launch_options_windows'>,
  root: SteamRoot,
  gamePath: string
): Promise<BottleLaunchOptionsResult> {
  return edits(async (): Promise<BottleLaunchOptionsResult> => {
    const configured = game.steam_launch_options_windows?.trim();
    if (!game.steam_app_id || !configured || root.prefix === null) {
      return { mode: 'noop' };
    }
    const resolution = resolveGameDirToken(
      configured,
      hostToWinePath(root.prefix, gamePath)
    );
    if (resolution.value === null) {
      return { mode: 'failed', reason: resolution.reason };
    }
    const entry = {
      prefix: root.prefix,
      steamPath: root.steamPath,
      appId: game.steam_app_id,
      value: resolution.value,
    };
    // A newer value for the same game must not be overwritten by an older queued one
    const others = readPending().filter(
      (item) => !(item.prefix === entry.prefix && item.appId === entry.appId)
    );
    if (await isBottleSteamRunning(root)) {
      writePending([...others, entry]);
      watchBottleSteamExit();
      return { mode: 'queued' };
    }
    writePending(others);
    try {
      writeToBottle(entry);
      return { mode: 'file' };
    } catch (error) {
      return { mode: 'failed', reason: errorMessage(error) };
    }
  });
}
