import { promises as fsp } from 'node:fs';
import { execFileOnHost, isFlatpak } from '@/main/utils/host-exec';
import { errorMessage } from '@/shared/errors';
import { groupSteamProcesses, ownUid, type SteamProcesses } from './process-info';

interface LinuxProcess {
  pid: number;
  ppid: number;
  comm: string;
  args: string | null;
}

const STEAM_COMMS: ReadonlySet<string> = new Set(['steam', 'steamwebhelper']);
const REAPER_COMMS: ReadonlySet<string> = new Set(['reaper']);

function readProcText(pid: string, file: string): Promise<string | null> {
  return fsp.readFile(`/proc/${pid}/${file}`, 'utf8').catch(() => null);
}

// The first Uid field is the real uid.
export function parseProcStatus(status: string): { ppid: number; uid: number | null } {
  const ppid = /^PPid:\s+(\d+)/m.exec(status);
  const uid = /^Uid:\s+(\d+)/m.exec(status);
  return {
    ppid: ppid ? Number.parseInt(ppid[1], 10) : 0,
    uid: uid ? Number.parseInt(uid[1], 10) : null,
  };
}

function isOwn(uid: number | null, own: number | null): boolean {
  return own === null || uid === own;
}

// By executable (comm), like pgrep -x: wrapper scripts and look-alikes do not count.
async function scanProc(comms: ReadonlySet<string>): Promise<LinuxProcess[] | null> {
  let entries: string[];
  try {
    entries = await fsp.readdir('/proc');
  } catch {
    return null;
  }
  const own = ownUid();
  const rows = await Promise.all(
    entries
      .filter((entry) => /^\d+$/.test(entry))
      .map(async (pid): Promise<LinuxProcess | null> => {
        const comm = (await readProcText(pid, 'comm'))?.trim();
        if (!comm || !comms.has(comm)) {
          return null;
        }
        const { ppid, uid } = parseProcStatus((await readProcText(pid, 'status')) ?? '');
        if (!isOwn(uid, own)) {
          return null;
        }
        const cmdline = await readProcText(pid, 'cmdline');
        return {
          pid: Number.parseInt(pid, 10),
          ppid,
          comm,
          args: cmdline === null ? null : cmdline.replace(/\0+$/, '').replace(/\0/g, ' '),
        };
      })
  );
  return rows.filter((row): row is LinuxProcess => row !== null);
}

export function parseLinuxPsOutput(stdout: string, own: number | null): LinuxProcess[] {
  const rows: LinuxProcess[] = [];
  for (const line of stdout.split('\n')) {
    const match = /^\s*(\d+)\s+(\d+)\s+(\d+)\s+(\S+)\s*(.*?)\s*$/.exec(line);
    if (match && isOwn(Number.parseInt(match[3], 10), own)) {
      rows.push({
        pid: Number.parseInt(match[1], 10),
        ppid: Number.parseInt(match[2], 10),
        comm: match[4],
        args: match[5],
      });
    }
  }
  return rows;
}

// Our Flatpak sandbox has its own /proc and cannot see host Steam.
async function listViaHostPs(comms: ReadonlySet<string>): Promise<LinuxProcess[] | null> {
  try {
    const { stdout } = await execFileOnHost(
      'ps',
      ['-ww', '-eo', 'pid=,ppid=,ruid=,comm=,args='],
      5000
    );
    return parseLinuxPsOutput(stdout, ownUid()).filter((row) => comms.has(row.comm));
  } catch (error) {
    console.warn('[HostPs] ps failed:', errorMessage(error));
    return null;
  }
}

// Only this user's processes.
export function listLinuxProcesses(
  comms: ReadonlySet<string>
): Promise<LinuxProcess[] | null> {
  return isFlatpak() ? listViaHostPs(comms) : scanProc(comms);
}

export async function listLinuxSteam(): Promise<SteamProcesses | null> {
  const rows = await listLinuxProcesses(STEAM_COMMS);
  return (
    rows &&
    groupSteamProcesses(
      rows.map(({ pid, ppid, comm, args }) => ({
        pid,
        ppid,
        args,
        kind: comm === 'steam' ? 'steam' : 'webhelper',
      }))
    )
  );
}

export async function listReaperArgs(): Promise<string[]> {
  return (await listLinuxProcesses(REAPER_COMMS))?.flatMap((row) => row.args ?? []) ?? [];
}
