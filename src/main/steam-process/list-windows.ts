import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { LRUCache } from 'lru-cache';
import { z } from 'zod';
import { system32 } from '@/main/utils/host-exec';
import { errorMessage } from '@/shared/errors';
import {
  groupSteamProcesses,
  type SteamProcesses,
  type SteamProcessKind,
} from './process-info';

const execFileAsync = promisify(execFile);
const TASKLIST_TIMEOUT_MS = 10000;

const IMAGE_KINDS: Record<string, SteamProcessKind> = {
  'steam.exe': 'steam',
  'steamwebhelper.exe': 'webhelper',
};

export function parseTasklistCsv(stdout: string, image: string): number[] {
  const wanted = image.toLowerCase();
  const pids: number[] = [];
  for (const line of stdout.split(/\r?\n/)) {
    const match = line.match(/^\s*"([^"]*)","(\d+)"/);
    if (match && match[1].toLowerCase() === wanted) {
      pids.push(Number.parseInt(match[2], 10));
    }
  }
  return pids;
}

// CSV columns: image name, PID, session name, session number, memory.
export function parseTasklistSession(stdout: string, pid: number): number | null {
  for (const line of stdout.split(/\r?\n/)) {
    const match = /^\s*"[^"]*","(\d+)","[^"]*","(\d+)"/.exec(line);
    if (match && Number.parseInt(match[1], 10) === pid) {
      return Number.parseInt(match[2], 10);
    }
  }
  return null;
}

// A process never changes session; a failed lookup is not kept.
const ownSession = new LRUCache<'session', { id: number }>({
  max: 1,
  ignoreFetchAbort: true,
  fetchMethod: async () => {
    const { stdout } = await execFileAsync(
      system32('tasklist.exe'),
      ['/FI', `PID eq ${process.pid}`, '/FO', 'CSV', '/NH'],
      { timeout: TASKLIST_TIMEOUT_MS, windowsHide: true }
    );
    const id = parseTasklistSession(stdout, process.pid);
    return id === null ? undefined : { id };
  },
});

// Fast user switching runs another user's Steam in another session; null when unknown.
async function ownSessionId(): Promise<number | null> {
  try {
    return (await ownSession.fetch('session'))?.id ?? null;
  } catch {
    return null;
  }
}

// tasklist and taskkill filter; an unknown session leaves every session in, as before.
export async function ownSessionFilter(): Promise<string[]> {
  const id = await ownSessionId();
  return id === null ? [] : ['/FI', `SESSION eq ${id}`];
}

const win32ProcessSchema = z
  .object({
    ProcessId: z.number(),
    Name: z.string(),
    ParentProcessId: z.number().catch(0),
    CommandLine: z.string().nullable().catch(null),
  })
  .transform((p) => ({
    pid: p.ProcessId,
    ppid: p.ParentProcessId,
    name: p.Name,
    args: p.CommandLine,
  }));

export function parseWin32ProcessJson(
  stdout: string
): z.infer<typeof win32ProcessSchema>[] {
  const text = stdout.replace(/^\uFEFF/, '').trim();
  if (!text) {
    return [];
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return [];
  }

  // A single process comes back as a bare object, not a one-element array.
  return (Array.isArray(parsed) ? parsed : [parsed]).flatMap(
    (item) => win32ProcessSchema.safeParse(item).data ?? []
  );
}

// tasklist shows no command lines, so a lingering crashpad helper counts as a webhelper here.
export async function listWindowsSteam(): Promise<SteamProcesses | null> {
  try {
    const { stdout } = await execFileAsync(
      system32('tasklist.exe'),
      ['/FI', 'IMAGENAME eq steam*', ...(await ownSessionFilter()), '/FO', 'CSV', '/NH'],
      { timeout: TASKLIST_TIMEOUT_MS, windowsHide: true }
    );
    const rows = (image: string) =>
      parseTasklistCsv(stdout, image).map((pid) => ({ pid, args: null }));
    return { steam: rows('steam.exe'), webhelpers: rows('steamwebhelper.exe') };
  } catch {
    return null;
  }
}

export function win32ProcessScript(session: number | null): string {
  const inSession = session === null ? '' : ` AND SessionId=${session}`;
  return [
    '[Console]::OutputEncoding = [System.Text.Encoding]::UTF8',
    `$p = @(Get-CimInstance Win32_Process -Filter "(Name='steam.exe' OR Name='steamwebhelper.exe')${inSession}" | Select-Object ProcessId,ParentProcessId,Name,CommandLine)`,
    'ConvertTo-Json -InputObject $p -Compress',
  ].join('\n');
}

export async function listWindowsSteamWithArgs(): Promise<SteamProcesses> {
  const script = win32ProcessScript(await ownSessionId());
  try {
    const { stdout } = await execFileAsync(
      system32('WindowsPowerShell', 'v1.0', 'powershell.exe'),
      [
        '-NoProfile',
        '-NonInteractive',
        '-ExecutionPolicy',
        'Bypass',
        '-EncodedCommand',
        Buffer.from(script, 'utf16le').toString('base64'),
      ],
      { timeout: 5000, windowsHide: true, maxBuffer: 16 * 1024 * 1024 }
    );
    return groupSteamProcesses(
      parseWin32ProcessJson(stdout).map((row) => ({
        ...row,
        kind: IMAGE_KINDS[row.name.toLowerCase()] ?? 'other',
      }))
    );
  } catch (error) {
    console.warn('[Steam] Process query failed:', errorMessage(error));
    return { steam: [], webhelpers: [] };
  }
}
