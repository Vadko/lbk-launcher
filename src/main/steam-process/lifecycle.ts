import { LRUCache } from 'lru-cache';
import pWaitFor from 'p-wait-for';
import { isWindows } from '@/main/utils/platform';
import { errnoCode } from '@/shared/errors';
import { steamProcesses } from './snapshot';

const STEAM_POLL_MS = 500;

// Status reads only: the shared snapshot, and a failed listing shows as no Steam.
export async function findSteamPids(): Promise<number[]> {
  return (await steamProcesses())?.steam.map((p) => p.pid) ?? [];
}

// Shutdown, kill and apply decisions: a fresh listing, null when it failed.
export async function listSteamPids(): Promise<number[] | null> {
  return (await steamProcesses({ fresh: true }))?.steam.map((p) => p.pid) ?? null;
}

// null when the listing failed; only the Steam monitor needs to tell that apart.
export async function probeSteamRunning(): Promise<boolean | null> {
  const pids = await listSteamPids();
  return pids && pids.length > 0;
}

// A failed listing reads as running: no write or skipped shutdown may rest on a guess.
export async function isSteamRunning(): Promise<boolean> {
  return (await probeSteamRunning()) ?? true;
}

// Counts the processes waitForSteamGone counts, but a failed listing reads as running: Steam's files must not change under it.
export async function isSteamStopped(): Promise<boolean> {
  const processes = await steamProcesses({ fresh: true });
  return (
    processes !== null &&
    processes.steam.length === 0 &&
    processes.webhelpers.length === 0
  );
}

function pollUntil(check: () => Promise<boolean>, timeoutMs: number): Promise<boolean> {
  return pWaitFor<boolean>(async () => (await check()) && pWaitFor.resolveWith(true), {
    interval: STEAM_POLL_MS,
    timeout: { milliseconds: timeoutMs, fallback: () => false },
  });
}

// A failed listing reads as gone; isSteamStopped still refuses to touch Steam's files then.
export function waitForSteamGone(timeoutMs: number): Promise<boolean> {
  return pollUntil(async () => {
    const processes = await steamProcesses({ fresh: true });
    return !processes || processes.steam.length + processes.webhelpers.length === 0;
  }, timeoutMs);
}

export function waitForSteamStart(timeoutMs: number): Promise<boolean> {
  return pollUntil(
    async () => ((await steamProcesses({ fresh: true }))?.steam.length ?? 0) > 0,
    timeoutMs
  );
}

// EPERM means the process exists but belongs to a higher integrity level or another user.
export function probePid(pid: number): 'alive' | 'denied' | 'gone' {
  try {
    process.kill(pid, 0);
    return 'alive';
  } catch (error) {
    return errnoCode(error) === 'EPERM' ? 'denied' : 'gone';
  }
}

// Keyed by the sorted pid list: elevation holds for the life of those processes.
const elevation = new LRUCache<string, boolean, readonly number[]>({
  max: 1,
  memoMethod: (_key, _stale, { context }) =>
    context.some((pid) => probePid(pid) === 'denied'),
});

export async function isSteamElevated(): Promise<boolean> {
  if (!isWindows()) {
    return false;
  }

  const pids = await findSteamPids();
  if (pids.length === 0) {
    return false;
  }

  const key = [...pids].sort((a, b) => a - b).join(',');
  return elevation.memo(key, { context: pids });
}
