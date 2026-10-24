import { promises as fsp } from 'node:fs';
import path from 'node:path';
import { getSteamPath } from '@/main/game-detector/steam';
import { probePid } from '@/main/steam-process/lifecycle';
import { listWindowsSteamWithArgs } from '@/main/steam-process/list-windows';
import type { SteamProcesses, SteamProcessInfo } from '@/main/steam-process/process-info';
import { steamProcesses } from '@/main/steam-process/snapshot';
import { isWindows } from '@/main/utils/platform';

const DEFAULT_CEF_PORT = 8080;
// Steam formats each log message into a 1024-byte buffer, so longer command lines are cut.
const WEBHELPER_LOG_MESSAGE_CAP = 1023;
const WEBHELPER_LOG_MARKER = 'Startup - webhelper launched pid:';

interface WebhelperDebugArgs {
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

function pickMainWebhelper(snapshot: SteamProcesses): SteamProcessInfo | null {
  const steamPids = new Set(snapshot.steam.map((p) => p.pid));
  const mains = snapshot.webhelpers.filter(
    (p) => p.args !== null && parseWebhelperDebugArgs(p.args).isMain
  );
  return (
    mains.find((p) => p.ppid !== undefined && steamPids.has(p.ppid)) ?? mains[0] ?? null
  );
}

// tasklist, behind the shared snapshot on Windows, shows no command lines.
async function processesWithArgs(): Promise<SteamProcesses> {
  if (isWindows()) {
    return listWindowsSteamWithArgs();
  }
  return (await steamProcesses()) ?? { steam: [], webhelpers: [] };
}

export async function discoverCefEndpoint(): Promise<CefEndpointDiscovery> {
  const logEntry = await readWebhelperLogEntry();
  if (logEntry) {
    const fromLog = parseWebhelperDebugArgs(logEntry.args);
    if (fromLog.port) {
      return { kind: 'port', port: fromLog.port };
    }
  }

  const snapshot = await processesWithArgs();
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
