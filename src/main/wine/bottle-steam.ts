import { execFile } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { promisify } from 'node:util';
import pLimit from 'p-limit';
import pWaitFor from 'p-wait-for';
import { z } from 'zod';
import { getSteamUserConfigPath } from '@/main/game-detector/steam';
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
import { type BottleSteam, bottleSteamOf } from './bottle-steam-roots';
import { hostToWinePath } from './dos-path';
import { startInWine } from './run';

const execFileAsync = promisify(execFile);

const PENDING_KEY = 'pending-wine-launch-options';
const POLL_MS = 15000;

function bottleArtworkTarget(bottle: BottleSteam): ArtworkTarget {
  return prefixArtworkTarget(
    bottle.prefix.prefix,
    getSteamUserConfigPath(bottle.steamPath, 'grid')
  );
}

/** The grid of the Steam a game copy belongs to; undefined for the native Steam. */
export function artworkTargetForGame(gamePath: string): ArtworkTarget | undefined {
  const bottle = bottleSteamOf(gamePath);
  return bottle ? bottleArtworkTarget(bottle) : undefined;
}

/** Asks the bottle's Steam to start the game, starting that Steam first when it is closed. */
export function launchInBottleSteam(gamePath: string, appId: number): boolean {
  const bottle = bottleSteamOf(gamePath);
  const steamExe = bottle
    ? fs
        .readdirSync(bottle.steamPath)
        .find((entry) => entry.toLowerCase() === 'steam.exe')
    : undefined;
  if (!bottle || !steamExe) {
    console.warn(`[Wine] No Steam for ${gamePath}`);
    return false;
  }
  return startInWine(bottle.prefix, path.join(bottle.steamPath, steamExe), [
    '-applaunch',
    String(appId),
  ]);
}

// Wine replaces a program's argv on macOS, so the bottle shows only through the working folder Steam runs in
async function isBottleSteamRunning(prefix: string): Promise<boolean> {
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
    if (!fs.existsSync(entry.steamPath)) {
      continue;
    }
    if (await isBottleSteamRunning(entry.prefix)) {
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
  bottle: BottleSteam,
  gamePath: string
): Promise<BottleLaunchOptionsResult> {
  const prefix = bottle.prefix.prefix;
  return edits(async (): Promise<BottleLaunchOptionsResult> => {
    const configured = game.steam_launch_options_windows?.trim();
    if (!game.steam_app_id || !configured) {
      return { mode: 'noop' };
    }
    const resolution = resolveGameDirToken(configured, hostToWinePath(prefix, gamePath));
    if (resolution.value === null) {
      return { mode: 'failed', reason: resolution.reason };
    }
    const entry = {
      prefix,
      steamPath: bottle.steamPath,
      appId: game.steam_app_id,
      value: resolution.value,
    };
    // A newer value for the same game must not be overwritten by an older queued one
    const others = readPending().filter(
      (item) => !(item.prefix === entry.prefix && item.appId === entry.appId)
    );
    if (await isBottleSteamRunning(prefix)) {
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
