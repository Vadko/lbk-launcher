export interface SteamProcessInfo {
  pid: number;
  ppid?: number;
  // null = unreadable (elevated Steam or another user).
  args: string | null;
}

// A lingering crashpad handler is left out of `webhelpers`.
export interface SteamProcesses {
  steam: SteamProcessInfo[];
  webhelpers: SteamProcessInfo[];
}

export type SteamProcessKind = 'steam' | 'webhelper' | 'other';

// The crashpad handler is a detached Steam Helper that may outlive the client.
function isCrashpadHandler(args: string | null): boolean {
  return (
    !!args && /(?:^|\s)--type=crashpad-handler(?:\s|$)/.test(args.replace(/\0/g, ' '))
  );
}

export function groupSteamProcesses(
  rows: readonly (SteamProcessInfo & { kind: SteamProcessKind })[]
): SteamProcesses {
  const out: SteamProcesses = { steam: [], webhelpers: [] };
  for (const { kind, pid, ppid, args } of rows) {
    if (kind === 'steam') {
      out.steam.push({ pid, ppid, args });
    } else if (kind === 'webhelper' && !isCrashpadHandler(args)) {
      out.webhelpers.push({ pid, ppid, args });
    }
  }
  return out;
}
