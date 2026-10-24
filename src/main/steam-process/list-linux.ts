import { promises as fsp } from 'node:fs';
import { execFileOnHost, isFlatpak } from '@/main/utils/host-exec';
import { errorMessage } from '@/shared/errors';
import { groupSteamProcesses, type SteamProcesses } from './process-info';

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

async function readProcStatusPpid(pid: string): Promise<number> {
  const status = await readProcText(pid, 'status');
  const match = status?.match(/^PPid:\s+(\d+)/m);
  return match ? Number.parseInt(match[1], 10) : 0;
}

// By executable (comm), like pgrep -x: wrapper scripts and look-alikes do not count.
async function scanProc(comms: ReadonlySet<string>): Promise<LinuxProcess[] | null> {
  let entries: string[];
  try {
    entries = await fsp.readdir('/proc');
  } catch {
    return null;
  }
  const rows = await Promise.all(
    entries
      .filter((entry) => /^\d+$/.test(entry))
      .map(async (pid): Promise<LinuxProcess | null> => {
        const comm = (await readProcText(pid, 'comm'))?.trim();
        if (!comm || !comms.has(comm)) {
          return null;
        }
        const cmdline = await readProcText(pid, 'cmdline');
        return {
          pid: Number.parseInt(pid, 10),
          ppid: await readProcStatusPpid(pid),
          comm,
          args: cmdline === null ? null : cmdline.replace(/\0+$/, '').replace(/\0/g, ' '),
        };
      })
  );
  return rows.filter((row): row is LinuxProcess => row !== null);
}

export function parseLinuxPsOutput(stdout: string): LinuxProcess[] {
  const rows: LinuxProcess[] = [];
  for (const line of stdout.split('\n')) {
    const match = /^\s*(\d+)\s+(\d+)\s+(\S+)\s*(.*?)\s*$/.exec(line);
    if (match) {
      rows.push({
        pid: Number.parseInt(match[1], 10),
        ppid: Number.parseInt(match[2], 10),
        comm: match[3],
        args: match[4],
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
      ['-ww', '-eo', 'pid=,ppid=,comm=,args='],
      5000
    );
    return parseLinuxPsOutput(stdout).filter((row) => comms.has(row.comm));
  } catch (error) {
    console.warn('[HostPs] ps failed:', errorMessage(error));
    return null;
  }
}

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
