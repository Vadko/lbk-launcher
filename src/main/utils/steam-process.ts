import { execFile } from 'child_process';
import { parse as vdfParse } from 'fast-vdf';
import { promises as fsp } from 'fs';
import { homedir } from 'os';
import path from 'path';
import { HKEY } from 'registry-js';
import { setTimeout as sleep } from 'timers/promises';
import { promisify } from 'util';
import { getSteamPath } from '@/main/game-detector/steam';
import { forCurrentOS, isLinux, isWindows } from '@/main/utils/platform';
import { getRegistryDword } from '@/main/utils/registry';
import {
  isCrashpadHandler,
  MAC_MILLENNIUM_LAUNCHER_RE,
} from '@/main/utils/steam-process-match';

const execFileAsync = promisify(execFile);

const DEFAULT_CEF_PORT = 8080;
// Steam formats each log message into a 1024-byte buffer, so longer command lines are cut.
const WEBHELPER_LOG_MESSAGE_CAP = 1023;
const WEBHELPER_LOG_MARKER = 'Startup - webhelper launched pid:';

interface SteamProcessInfo {
  pid: number;
  ppid?: number;
  // null = unreadable (elevated Steam or another user).
  args: string | null;
}

export interface WebhelperDebugArgs {
  isMain: boolean;
  port: number | null;
  pipe: boolean;
  millenniumFlags: boolean;
}

export type CefEndpointDiscovery =
  // `assumed`: no port argument was visible, so the caller should still try the default port.
  | { kind: 'port'; port: number; assumed?: boolean }
  | { kind: 'pipe' }
  | { kind: 'none' }
  | { kind: 'unreadable' };

interface ProcessRow {
  pid: number;
  ppid: number;
  args: string | null;
}

interface SteamProcessSnapshot {
  steam: SteamProcessInfo[];
  webhelpers: SteamProcessInfo[];
}

function isRunningInFlatpak(): boolean {
  return !!process.env.FLATPAK_ID;
}

export function execFileOnHost(
  command: string,
  args: string[],
  timeout = 10000
): Promise<{ stdout: string; stderr: string }> {
  if (isRunningInFlatpak()) {
    return execFileAsync('flatpak-spawn', ['--host', command, ...args], {
      timeout,
      maxBuffer: 16 * 1024 * 1024,
    });
  }
  return execFileAsync(command, args, { timeout, maxBuffer: 16 * 1024 * 1024 });
}

function parsePort(raw: string | undefined): number | null {
  if (!raw) {
    return null;
  }
  const port = Number.parseInt(raw, 10);
  return Number.isInteger(port) && port > 0 && port <= 65535 ? port : null;
}

export function parseWebhelperDebugArgs(cmdline: string): WebhelperDebugArgs {
  const s = cmdline.replace(/\0/g, ' ');
  const pipe = /(?:^|\s)--remote-debugging-pipe(?:\s|=|$)/.test(s);
  const millenniumFlags =
    /--millennium-loopback-ipc-(?:handles|fds)=/.test(s) ||
    /PRESSURE_VESSEL_PREFIX=/.test(s) ||
    pipe;
  return {
    isMain: !/(?:^|\s)--type=/.test(s),
    port: parsePort(s.match(/(?:^|\s)--remote-debugging-port=(\d+)/)?.[1]),
    pipe,
    millenniumFlags,
  };
}

export function parseDevtoolsPortArg(cmdline: string): number | null {
  const s = cmdline.replace(/\0/g, ' ');
  return parsePort(s.match(/(?:^|\s)-devtools-port(?:=|\s+)(\d+)/)?.[1]);
}

export function parseWebhelperLog(text: string): { pid: number; args: string } | null {
  const at = text.lastIndexOf(WEBHELPER_LOG_MARKER);
  if (at < 0) {
    return null;
  }

  const lineEnd = text.slice(at).search(/[\r\n]/);
  const message = lineEnd < 0 ? text.slice(at) : text.slice(at, at + lineEnd);
  const match = message.match(
    /^Startup - webhelper launched pid: (\d+) commandline: (.*)$/
  );
  if (!match) {
    return null;
  }

  const pid = Number.parseInt(match[1], 10);
  let args = match[2].trim();
  if (message.length >= WEBHELPER_LOG_MESSAGE_CAP) {
    // The last token may be cut mid-value (e.g. a port with missing digits).
    args = args.replace(/\s*\S*$/, '');
  }
  return pid > 0 ? { pid, args } : null;
}

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

export function parseWin32ProcessJson(
  stdout: string
): { pid: number; ppid: number; name: string; args: string | null }[] {
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

  const items = Array.isArray(parsed) ? parsed : [parsed];
  const rows: { pid: number; ppid: number; name: string; args: string | null }[] = [];
  for (const item of items) {
    if (!item || typeof item !== 'object') {
      continue;
    }
    const record = item as Record<string, unknown>;
    if (typeof record.ProcessId !== 'number' || typeof record.Name !== 'string') {
      continue;
    }
    rows.push({
      pid: record.ProcessId,
      ppid: typeof record.ParentProcessId === 'number' ? record.ParentProcessId : 0,
      name: record.Name,
      args: typeof record.CommandLine === 'string' ? record.CommandLine : null,
    });
  }
  return rows;
}

type SteamProcessKind = 'steam' | 'webhelper' | 'other';

const MAC_STEAM_RE = /\/Contents\/MacOS\/steam_osx(?=\s|$)/;
const MAC_HELPER_RE = /\/Contents\/MacOS\/Steam Helper(?: \([A-Za-z ]+\))?(?=\s|$)/;

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

export function classifyLinuxProcess(args: string): SteamProcessKind {
  const exe = path.posix.basename(args.replace(/\0/g, ' ').trim().split(/\s+/)[0] ?? '');
  if (exe === 'steam') {
    return 'steam';
  }
  return exe === 'steamwebhelper' ? 'webhelper' : 'other';
}

function toInfo(row: ProcessRow): SteamProcessInfo {
  return { pid: row.pid, ppid: row.ppid, args: row.args };
}

function splitRows(
  rows: ProcessRow[],
  classify: (args: string) => SteamProcessKind
): SteamProcessSnapshot {
  const snapshot: SteamProcessSnapshot = { steam: [], webhelpers: [] };
  for (const row of rows) {
    if (!row.args) {
      continue;
    }
    const kind = classify(row.args);
    if (kind === 'steam') {
      snapshot.steam.push(toInfo(row));
    } else if (kind === 'webhelper' && !isCrashpadHandler(row.args)) {
      snapshot.webhelpers.push(toInfo(row));
    }
  }
  return snapshot;
}

async function readProcText(pid: string, file: string): Promise<string | null> {
  try {
    return await fsp.readFile(`/proc/${pid}/${file}`, 'utf8');
  } catch {
    return null;
  }
}

async function readProcStatusPpid(pid: string): Promise<number> {
  const status = await readProcText(pid, 'status');
  const match = status?.match(/^PPid:\s+(\d+)/m);
  return match ? Number.parseInt(match[1], 10) : 0;
}

async function scanLinuxProc(): Promise<SteamProcessSnapshot> {
  let entries: string[];
  try {
    entries = await fsp.readdir('/proc');
  } catch {
    return { steam: [], webhelpers: [] };
  }

  const snapshot: SteamProcessSnapshot = { steam: [], webhelpers: [] };
  await Promise.all(
    entries
      .filter((entry) => /^\d+$/.test(entry))
      .map(async (pid) => {
        const comm = (await readProcText(pid, 'comm'))?.trim();
        if (comm !== 'steam' && comm !== 'steamwebhelper') {
          return;
        }
        const cmdline = await readProcText(pid, 'cmdline');
        const args =
          cmdline === null ? null : cmdline.replace(/\0+$/, '').replace(/\0/g, ' ');
        const info: SteamProcessInfo = {
          pid: Number.parseInt(pid, 10),
          ppid: await readProcStatusPpid(pid),
          args,
        };
        if (comm === 'steam') {
          snapshot.steam.push(info);
        } else if (!isCrashpadHandler(args)) {
          snapshot.webhelpers.push(info);
        }
      })
  );
  return snapshot;
}

async function listViaPs(
  psArgs: string[],
  classify: (args: string) => SteamProcessKind
): Promise<SteamProcessSnapshot> {
  try {
    const { stdout } = await execFileOnHost('ps', psArgs, 5000);
    return splitRows(parsePsOutput(stdout), classify);
  } catch (error) {
    console.warn('[Steam] ps failed:', error instanceof Error ? error.message : error);
    return { steam: [], webhelpers: [] };
  }
}

function getSystem32Path(...segments: string[]): string {
  return path.win32.join(
    process.env.SystemRoot || 'C:\\Windows',
    'System32',
    ...segments
  );
}

async function tasklistPids(image: string): Promise<number[]> {
  try {
    const { stdout } = await execFileAsync(
      getSystem32Path('tasklist.exe'),
      ['/FI', `IMAGENAME eq ${image}`, '/FO', 'CSV', '/NH'],
      { timeout: 10000, windowsHide: true }
    );
    return parseTasklistCsv(stdout, image);
  } catch {
    return [];
  }
}

const WIN32_PROCESS_SCRIPT = [
  '[Console]::OutputEncoding = [System.Text.Encoding]::UTF8',
  "$p = @(Get-CimInstance Win32_Process -Filter \"Name='steam.exe' OR Name='steamwebhelper.exe'\" | Select-Object ProcessId,ParentProcessId,Name,CommandLine)",
  'ConvertTo-Json -InputObject $p -Compress',
].join('\n');

async function listWindowsProcesses(): Promise<SteamProcessSnapshot> {
  try {
    const { stdout } = await execFileAsync(
      getSystem32Path('WindowsPowerShell', 'v1.0', 'powershell.exe'),
      [
        '-NoProfile',
        '-NonInteractive',
        '-ExecutionPolicy',
        'Bypass',
        '-EncodedCommand',
        Buffer.from(WIN32_PROCESS_SCRIPT, 'utf16le').toString('base64'),
      ],
      { timeout: 5000, windowsHide: true, maxBuffer: 16 * 1024 * 1024 }
    );
    const snapshot: SteamProcessSnapshot = { steam: [], webhelpers: [] };
    for (const row of parseWin32ProcessJson(stdout)) {
      const name = row.name.toLowerCase();
      if (name === 'steam.exe') {
        snapshot.steam.push(toInfo(row));
      } else if (name === 'steamwebhelper.exe' && !isCrashpadHandler(row.args)) {
        snapshot.webhelpers.push(toInfo(row));
      }
    }
    return snapshot;
  } catch (error) {
    console.warn(
      '[Steam] Process query failed:',
      error instanceof Error ? error.message : error
    );
    return { steam: [], webhelpers: [] };
  }
}

function collectSteamProcesses(): Promise<SteamProcessSnapshot> {
  const empty = (): Promise<SteamProcessSnapshot> =>
    Promise.resolve({ steam: [], webhelpers: [] });
  const collect = forCurrentOS({
    windows: listWindowsProcesses,
    linux: () =>
      isRunningInFlatpak()
        ? listViaPs(['-ww', '-eo', 'pid=,ppid=,args='], classifyLinuxProcess)
        : scanLinuxProc(),
    macos: () => listViaPs(['-axww', '-o', 'pid=,ppid=,args='], classifyMacProcess),
    other: empty,
  });
  return collect();
}

function pickMainWebhelper(snapshot: SteamProcessSnapshot): SteamProcessInfo | null {
  const steamPids = new Set(snapshot.steam.map((p) => p.pid));
  const mains = snapshot.webhelpers.filter(
    (p) => p.args !== null && parseWebhelperDebugArgs(p.args).isMain
  );
  return (
    mains.find((p) => p.ppid !== undefined && steamPids.has(p.ppid)) ?? mains[0] ?? null
  );
}

async function pgrepPids(name: string): Promise<number[]> {
  try {
    const { stdout } = await execFileOnHost('pgrep', ['-x', name], 5000);
    return stdout
      .split(/\s+/)
      .filter((s) => /^\d+$/.test(s))
      .map((s) => Number.parseInt(s, 10));
  } catch {
    // pgrep exits 1 when nothing matches.
    return [];
  }
}

// By executable (comm), not args: a shell whose command line mentions steam_osx is not Steam.
async function macSteamPids(): Promise<number[]> {
  const pids = await pgrepPids('steam_osx');
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

export function findSteamPids(): Promise<number[]> {
  const find = forCurrentOS({
    windows: () => tasklistPids('steam.exe'),
    linux: async () =>
      isRunningInFlatpak()
        ? pgrepPids('steam')
        : (await scanLinuxProc()).steam.map((p) => p.pid),
    macos: macSteamPids,
    other: (): Promise<number[]> => Promise.resolve([]),
  });
  return find();
}

async function isAnySteamProcessLeft(): Promise<boolean> {
  if (isWindows()) {
    const [steam, helpers] = await Promise.all([
      tasklistPids('steam.exe'),
      tasklistPids('steamwebhelper.exe'),
    ]);
    return steam.length > 0 || helpers.length > 0;
  }
  const snapshot = await collectSteamProcesses();
  return snapshot.steam.length > 0 || snapshot.webhelpers.length > 0;
}

const STEAM_POLL_MS = 500;

async function pollUntil(
  check: () => Promise<boolean>,
  timeoutMs: number
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    if (await check()) {
      return true;
    }
    if (Date.now() >= deadline) {
      return false;
    }
    await sleep(STEAM_POLL_MS);
  }
}

export function waitForSteamGone(timeoutMs: number): Promise<boolean> {
  return pollUntil(async () => !(await isAnySteamProcessLeft()), timeoutMs);
}

export function waitForSteamStart(timeoutMs: number): Promise<boolean> {
  return pollUntil(async () => (await findSteamPids()).length > 0, timeoutMs);
}

// EPERM means the process exists but belongs to a higher integrity level or another user.
function probePid(pid: number): 'alive' | 'denied' | 'gone' {
  try {
    process.kill(pid, 0);
    return 'alive';
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === 'EPERM' ? 'denied' : 'gone';
  }
}

let elevationCache: { pids: string; elevated: boolean } | null = null;

export async function isSteamElevated(): Promise<boolean> {
  if (!isWindows()) {
    return false;
  }

  const pids = await findSteamPids();
  if (pids.length === 0) {
    return false;
  }

  const key = [...pids].sort((a, b) => a - b).join(',');
  if (elevationCache?.pids === key) {
    return elevationCache.elevated;
  }

  const elevated = pids.some((pid) => probePid(pid) === 'denied');
  elevationCache = { pids: key, elevated };
  return elevated;
}

async function readWebhelperLogEntry(): Promise<{ pid: number; args: string } | null> {
  const steamPath = getSteamPath();
  if (!steamPath) {
    return null;
  }
  try {
    // The log mixes encodings; latin1 keeps byte offsets and ASCII flags intact.
    const text = await fsp.readFile(
      path.join(steamPath, 'logs', 'webhelper.txt'),
      'latin1'
    );
    const entry = parseWebhelperLog(text);
    return entry && probePid(entry.pid) !== 'gone' ? entry : null;
  } catch {
    return null;
  }
}

export async function discoverCefEndpoint(): Promise<CefEndpointDiscovery> {
  const logEntry = await readWebhelperLogEntry();
  if (logEntry) {
    const fromLog = parseWebhelperDebugArgs(logEntry.args);
    if (fromLog.port) {
      return { kind: 'port', port: fromLog.port };
    }
  }

  const snapshot = await collectSteamProcesses();
  if (snapshot.steam.length === 0 && snapshot.webhelpers.length === 0) {
    return { kind: 'none' };
  }

  const main = pickMainWebhelper(snapshot);
  if (!main) {
    const unreadable = snapshot.webhelpers.some((p) => p.args === null);
    return unreadable ? { kind: 'unreadable' } : { kind: 'none' };
  }

  const mainArgs = parseWebhelperDebugArgs(main.args ?? '');
  if (mainArgs.port) {
    return { kind: 'port', port: mainArgs.port };
  }
  if (mainArgs.pipe) {
    return { kind: 'pipe' };
  }

  for (const helper of snapshot.webhelpers) {
    const port = helper.args ? parseWebhelperDebugArgs(helper.args).port : null;
    if (port) {
      return { kind: 'port', port };
    }
  }

  for (const steam of snapshot.steam) {
    const port = steam.args ? parseDevtoolsPortArg(steam.args) : null;
    if (port) {
      return { kind: 'port', port };
    }
  }

  // A missing port argument proves nothing: the macOS client can open 8080 without passing it to Steam Helper.
  return { kind: 'port', port: DEFAULT_CEF_PORT, assumed: true };
}

async function readLinuxSteamProcFile(
  file: 'maps' | 'environ'
): Promise<Buffer[] | null> {
  // Our Flatpak sandbox has its own /proc and cannot see host Steam.
  if (isRunningInFlatpak()) {
    return null;
  }
  const { steam } = await scanLinuxProc();
  const out: Buffer[] = [];
  for (const proc of steam) {
    try {
      out.push(await fsp.readFile(`/proc/${proc.pid}/${file}`));
    } catch {
      // Exited, or another user's process.
    }
  }
  return out.length > 0 ? out : null;
}

// null when it cannot be told (Flatpak, Steam not running, unreadable /proc).
export async function steamMapsContain(lib: string): Promise<boolean | null> {
  const maps = await readLinuxSteamProcFile('maps');
  return maps === null ? null : maps.some((buf) => buf.toString('latin1').includes(lib));
}

export function readSteamEnvirons(): Promise<Buffer[] | null> {
  return readLinuxSteamProcFile('environ');
}

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

async function linuxReaperArgs(): Promise<string[]> {
  if (isRunningInFlatpak()) {
    const pids = await pgrepPids('reaper');
    if (pids.length === 0) {
      return [];
    }
    try {
      const { stdout } = await execFileOnHost(
        'ps',
        ['-ww', '-o', 'args=', '-p', pids.join(',')],
        5000
      );
      return stdout.split('\n');
    } catch {
      return [];
    }
  }
  const entries = await fsp.readdir('/proc').catch((): string[] => []);
  const args = await Promise.all(
    entries
      .filter((entry) => /^\d+$/.test(entry))
      .map(async (pid) =>
        (await readProcText(pid, 'comm'))?.trim() === 'reaper'
          ? readProcText(pid, 'cmdline')
          : null
      )
  );
  return args.flatMap((cmdline) =>
    cmdline === null ? [] : [cmdline.replace(/\0/g, ' ')]
  );
}

function registryVdfCandidates(): string[] {
  const home = homedir();
  return (
    forCurrentOS({
      linux: () => [
        path.join(home, '.steam', 'registry.vdf'),
        path.join(home, '.var/app/com.valvesoftware.Steam/.steam/registry.vdf'),
      ],
      macos: () => {
        const steamPath = getSteamPath();
        return steamPath ? [path.join(steamPath, 'registry.vdf')] : [];
      },
      windows: () => [],
    })?.() ?? []
  );
}

// Steam holds -shutdown while a game runs, and a forced kill would take the game's unsaved progress with it.
export async function getRunningSteamGameId(): Promise<number | null> {
  if (isWindows()) {
    return steamGameId(
      getRegistryDword(HKEY.HKEY_CURRENT_USER, 'Software\\Valve\\Steam', 'RunningAppID')
    );
  }
  if (isLinux()) {
    const id = (await linuxReaperArgs())
      .map(parseReaperAppId)
      .find((v): v is number => v !== null);
    if (id !== undefined) {
      return id;
    }
  }
  for (const file of registryVdfCandidates()) {
    const content = await fsp.readFile(file, 'utf8').catch(() => null);
    const id = content === null ? null : parseRunningAppId(content);
    if (id !== null) {
      return id;
    }
  }
  return null;
}
