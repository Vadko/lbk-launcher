import { execFileOnHost } from '@/main/utils/host-exec';
import { errnoCode, errorMessage } from '@/shared/errors';
import {
  groupSteamProcesses,
  type SteamProcesses,
  type SteamProcessKind,
} from './process-info';

const MAC_STEAM_RE = /\/Contents\/MacOS\/steam_osx(?=\s|$)/;
const MAC_HELPER_RE = /\/Contents\/MacOS\/Steam Helper(?: \([A-Za-z ]+\))?(?=\s|$)/;
// Millennium's launcher and its port-probe child are named steam_osx too but are not Steam.
const MAC_MILLENNIUM_LAUNCHER_RE =
  /(?:\/Steam Millennium\.app\/Contents\/MacOS|\/Millennium\/runtime\/[^/]+)\/steam_osx(?=\s|$)/;

export function parsePsOutput(
  stdout: string
): { pid: number; ppid: number; args: string }[] {
  const rows: { pid: number; ppid: number; args: string }[] = [];
  for (const line of stdout.split(/\r?\n/)) {
    const match = line.match(/^\s*(\d+)\s+(\d+)\s+(.+?)\s*$/);
    if (match) {
      rows.push({
        pid: Number.parseInt(match[1], 10),
        ppid: Number.parseInt(match[2], 10),
        args: match[3],
      });
    }
  }
  return rows;
}

// The executable path comes first, so the earliest match wins: Steam Helper's own args carry -steampath=…/steam_osx.
export function classifyMacProcess(args: string): SteamProcessKind {
  const steamAt = args.search(MAC_STEAM_RE);
  const helperAt = args.search(MAC_HELPER_RE);
  if (helperAt >= 0 && (steamAt < 0 || helperAt < steamAt)) {
    return 'webhelper';
  }
  const launcherAt = args.search(MAC_MILLENNIUM_LAUNCHER_RE);
  if (launcherAt >= 0 && (steamAt < 0 || launcherAt <= steamAt)) {
    return 'other';
  }
  return steamAt >= 0 ? 'steam' : 'other';
}

// By executable (comm), not args: a shell whose command line mentions steam_osx is not Steam.
async function macSteamPids(): Promise<number[] | null> {
  let pids: number[];
  try {
    const { stdout } = await execFileOnHost('pgrep', ['-x', 'steam_osx'], 5000);
    pids = stdout
      .split(/\s+/)
      .filter((s) => /^\d+$/.test(s))
      .map((s) => Number.parseInt(s, 10));
  } catch (error) {
    // pgrep exits 1 when nothing matches.
    return errnoCode(error) === 1 ? [] : null;
  }
  if (pids.length === 0) {
    return [];
  }
  try {
    const { stdout } = await execFileOnHost(
      'ps',
      ['-o', 'pid=,comm=', '-p', pids.join(',')],
      5000
    );
    return stdout
      .split('\n')
      .map((line) => /^\s*(\d+)\s+(.+)$/.exec(line))
      .filter(
        (m): m is RegExpExecArray => m !== null && !MAC_MILLENNIUM_LAUNCHER_RE.test(m[2])
      )
      .map((m) => Number.parseInt(m[1], 10));
  } catch {
    return pids;
  }
}

async function macProcessRows(): Promise<{ pid: number; ppid: number; args: string }[]> {
  try {
    const { stdout } = await execFileOnHost(
      'ps',
      ['-axww', '-o', 'pid=,ppid=,args='],
      5000
    );
    return parsePsOutput(stdout);
  } catch (error) {
    console.warn('[Steam] ps failed:', errorMessage(error));
    return [];
  }
}

export async function listMacSteam(): Promise<SteamProcesses | null> {
  const [pids, rows] = await Promise.all([macSteamPids(), macProcessRows()]);
  if (pids === null) {
    return null;
  }
  const byPid = new Map(rows.map((row) => [row.pid, row]));
  return {
    steam: pids.map((pid) => ({
      pid,
      ppid: byPid.get(pid)?.ppid,
      args: byPid.get(pid)?.args ?? null,
    })),
    webhelpers: groupSteamProcesses(
      rows.map((row) => ({ ...row, kind: classifyMacProcess(row.args) }))
    ).webhelpers,
  };
}
