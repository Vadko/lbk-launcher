import { LRUCache } from 'lru-cache';
import { forCurrentOS } from '@/main/utils/platform';
import { listLinuxSteam } from './list-linux';
import { listMacSteam } from './list-macos';
import { listWindowsSteam } from './list-windows';
import type { SteamProcesses } from './process-info';

const SNAPSHOT_TTL_MS = 500;

function listSteam(): Promise<SteamProcesses | null> {
  const list = forCurrentOS<() => Promise<SteamProcesses | null>>({
    windows: listWindowsSteam,
    linux: listLinuxSteam,
    macos: listMacSteam,
    other: () => Promise.resolve({ steam: [], webhelpers: [] }),
  });
  return list();
}

// Status, bridge and host-state reads come in bursts; they share one scan. Boxed: the cache cannot hold null.
const snapshots = new LRUCache<'steam', { processes: SteamProcesses | null }>({
  max: 1,
  ttl: SNAPSHOT_TTL_MS,
  ignoreFetchAbort: true,
  fetchMethod: async () => ({ processes: await listSteam() }),
});

// null when the listing failed, so nothing can be said about Steam.
export async function steamProcesses(
  opts: { fresh?: boolean } = {}
): Promise<SteamProcesses | null> {
  if (opts.fresh) {
    const processes = await listSteam();
    snapshots.set('steam', { processes });
    return processes;
  }
  return (await snapshots.forceFetch('steam')).processes;
}
