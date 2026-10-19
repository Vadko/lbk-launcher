import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { HKEY } from 'registry-js';
import { forCurrentOS } from '@/main/utils/platform';
import { getRegistryDword } from '@/main/utils/registry';
import { listReaperArgs } from './list-linux';

const execFileAsync = promisify(execFile);

// Non-Steam shortcuts get ids with the high bit set; only a real Steam app blocks a restart.
const SHORTCUT_APP_ID_MIN = 0x80000000;

function steamGameId(value: number | null): number | null {
  return value !== null && value > 0 && value < SHORTCUT_APP_ID_MIN ? value : null;
}

// Linux Steam never writes RunningAppID (registry.vdf included); it starts every game as `reaper SteamLaunch AppId=<id> -- …`.
export function parseReaperAppId(args: string): number | null {
  const match = / SteamLaunch AppId=(\d+)(?: |$)/.exec(args.split(' -- ')[0]);
  return steamGameId(match ? Number(match[1]) : null);
}

// macOS Steam never writes it either, even while a game runs; every game process inherits SteamGameId from steam_osx.
export function parseEnvSteamGameId(psOutput: string): number | null {
  for (const match of psOutput.matchAll(/(?:^|\s)SteamGameId=(\d+)(?=\s|$)/gm)) {
    const id = steamGameId(Number(match[1]));
    if (id !== null) {
      return id;
    }
  }
  return null;
}

async function macSteamGameIdFromEnv(): Promise<number | null> {
  try {
    const { stdout } = await execFileAsync(
      '/bin/ps',
      ['-E', '-x', '-ww', '-o', 'command='],
      { timeout: 5000, maxBuffer: 32 * 1024 * 1024 }
    );
    return parseEnvSteamGameId(stdout);
  } catch {
    return null;
  }
}

async function linuxReaperGameId(): Promise<number | null> {
  return (
    (await listReaperArgs())
      .map(parseReaperAppId)
      .find((id): id is number => id !== null) ?? null
  );
}

const RUNNING_GAME: Record<'windows' | 'linux' | 'macos', () => Promise<number | null>> =
  {
    windows: () =>
      Promise.resolve(
        steamGameId(
          getRegistryDword(
            HKEY.HKEY_CURRENT_USER,
            'Software\\Valve\\Steam',
            'RunningAppID'
          )
        )
      ),
    linux: linuxReaperGameId,
    macos: macSteamGameIdFromEnv,
  };

// Steam holds -shutdown while a game runs, and a forced kill would take the game's unsaved progress with it.
export function getRunningSteamGameId(): Promise<number | null> {
  return forCurrentOS(RUNNING_GAME)?.() ?? Promise.resolve(null);
}
