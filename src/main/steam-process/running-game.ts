import { execFile } from 'node:child_process';
import { promises as fsp } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { parse as vdfParse } from 'fast-vdf';
import { HKEY } from 'registry-js';
import { getSteamPath } from '@/main/game-detector/steam';
import { forCurrentOS } from '@/main/utils/platform';
import { getRegistryDword } from '@/main/utils/registry';
import { listReaperArgs } from './list-linux';

const execFileAsync = promisify(execFile);

// Non-Steam shortcuts get ids with the high bit set; only a real Steam app blocks a restart.
const SHORTCUT_APP_ID_MIN = 0x80000000;

function steamGameId(value: number | null): number | null {
  return value !== null && value > 0 && value < SHORTCUT_APP_ID_MIN ? value : null;
}

export function parseRunningAppId(registryVdf: string): number | null {
  try {
    const raw = vdfParse(registryVdf)
      .dir('Registry', null)
      ?.dir('HKCU', null)
      ?.dir('Software', null)
      ?.dir('Valve', null)
      ?.dir('Steam', null)
      ?.value('RunningAppID', null);
    return steamGameId(raw === null || raw === undefined ? null : Number(raw));
  } catch {
    return null;
  }
}

// Linux Steam does not write RunningAppID to registry.vdf; it starts every game as `reaper SteamLaunch AppId=<id> -- …`.
export function parseReaperAppId(args: string): number | null {
  const match = / SteamLaunch AppId=(\d+)(?: |$)/.exec(args.split(' -- ')[0]);
  return steamGameId(match ? Number(match[1]) : null);
}

// macOS Steam does not write RunningAppID either; every game process inherits SteamGameId from steam_osx.
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

interface RunningGameSource {
  live: () => Promise<number | null>;
  registryVdfs: () => string[];
}

const RUNNING_GAME_SOURCES: Record<'windows' | 'linux' | 'macos', RunningGameSource> = {
  windows: {
    live: async () =>
      steamGameId(
        getRegistryDword(HKEY.HKEY_CURRENT_USER, 'Software\\Valve\\Steam', 'RunningAppID')
      ),
    registryVdfs: () => [],
  },
  linux: {
    live: linuxReaperGameId,
    registryVdfs: () => [
      path.join(homedir(), '.steam', 'registry.vdf'),
      path.join(homedir(), '.var/app/com.valvesoftware.Steam/.steam/registry.vdf'),
    ],
  },
  macos: {
    live: macSteamGameIdFromEnv,
    registryVdfs: () => {
      const steamPath = getSteamPath();
      return steamPath ? [path.join(steamPath, 'registry.vdf')] : [];
    },
  },
};

// Steam holds -shutdown while a game runs, and a forced kill would take the game's unsaved progress with it.
export async function getRunningSteamGameId(): Promise<number | null> {
  const source = forCurrentOS(RUNNING_GAME_SOURCES);
  if (!source) {
    return null;
  }
  const live = await source.live();
  if (live !== null) {
    return live;
  }
  for (const file of source.registryVdfs()) {
    const content = await fsp.readFile(file, 'utf8').catch(() => null);
    const id = content === null ? null : parseRunningAppId(content);
    if (id !== null) {
      return id;
    }
  }
  return null;
}
