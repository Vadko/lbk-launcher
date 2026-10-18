// CDP transport of the Steam bridge: Runtime.evaluate of the shared ops in SharedJSContext.

import {
  isPluginOnlyOp,
  type SteamOpName,
  type SteamOps,
} from '@lbk/bridge-core/contract';
import CDP from 'chrome-remote-interface';
import { LRUCache } from 'lru-cache';
import pTimeout from 'p-timeout';
import { findSteamPids } from '@/main/steam-process/lifecycle';
import { STEAM_OPS_SOURCE } from '@/main/utils/steam-bridge-ops';
import {
  type CefEndpointDiscovery,
  discoverCefEndpoint,
} from '@/main/utils/steam-cef-discovery';

const DEFAULT_CEF_PORT = 8080;
// Chromium 126 binds ::1 when 127.0.0.1 is taken.
const CEF_HOSTS = ['127.0.0.1', '::1'] as const;
const STEAM_USER_AGENT_MARKER = 'Valve Steam Client';
const TARGET_TITLE = 'SharedJSContext';
const TARGET_URL_PREFIX = 'https://steamloopback.host/index.html';
const CEF_PROBE_TIMEOUT_MS = 1500;
const CEF_CONNECT_TIMEOUT_MS = 8000;
const CEF_EVAL_TIMEOUT_MS = 15000;
const DISCOVERY_REUSE_MS = 30_000;
// Back-to-back bridge lookups and invokes skip the process scan, which costs a tasklist spawn on Windows.
const ENDPOINT_REUSE_MS = 2000;

type CefHost = (typeof CEF_HOSTS)[number];

interface CefEndpoint {
  host: CefHost;
  port: number;
}

interface CefResolution {
  steamRunning: boolean;
  endpoint: CefEndpoint | null;
  // null when the default port answered and no process inspection was needed.
  discovery: CefEndpointDiscovery | null;
}

const NO_DISCOVERY: CefEndpointDiscovery = { kind: 'none' };

// Stale entries stay so the next lookup can re-probe the last endpoint instead of scanning ports.
const endpoints = new LRUCache<'cef', { pidKey: string; endpoint: CefEndpoint }>({
  max: 1,
  ttl: ENDPOINT_REUSE_MS,
  noDeleteOnStaleGet: true,
});

// Keyed by the Steam pid set; `none` usually means the webhelper has not started yet, so it is not stored.
const discoveries = new LRUCache<string, CefEndpointDiscovery>({
  max: 1,
  ttl: DISCOVERY_REUSE_MS,
  ignoreFetchAbort: true,
  fetchMethod: async () => {
    const discovery = await discoverCefEndpoint();
    return discovery.kind === 'none' ? undefined : discovery;
  },
});

// Another app on the port must never receive Steam ops, hence the User-Agent check.
async function probeEndpoint(host: CefHost, port: number): Promise<boolean> {
  try {
    const info = await pTimeout(CDP.Version({ host, port }), {
      milliseconds: CEF_PROBE_TIMEOUT_MS,
      message: `CEF probe timed out after ${CEF_PROBE_TIMEOUT_MS}ms`,
    });
    const userAgent = info['User-Agent'];
    return typeof userAgent === 'string' && userAgent.includes(STEAM_USER_AGENT_MARKER);
  } catch {
    return false;
  }
}

async function probePort(port: number): Promise<CefEndpoint | null> {
  for (const host of CEF_HOSTS) {
    if (await probeEndpoint(host, port)) {
      return { host, port };
    }
  }
  return null;
}

export function resetCefEndpointCache(): void {
  endpoints.clear();
  discoveries.clear();
}

export async function resolveCefEndpoint(
  opts: { fresh?: boolean } = {}
): Promise<CefResolution> {
  const recent = opts.fresh ? undefined : endpoints.get('cef');
  if (recent) {
    return { steamRunning: true, endpoint: recent.endpoint, discovery: null };
  }
  const pids = await findSteamPids();
  if (pids.length === 0) {
    resetCefEndpointCache();
    return { steamRunning: false, endpoint: null, discovery: null };
  }
  const pidKey = [...pids].sort((a, b) => a - b).join(',');

  const known = endpoints.get('cef', { allowStale: true });
  endpoints.clear();
  if (known?.pidKey === pidKey) {
    const { host, port } = known.endpoint;
    if (await probeEndpoint(host, port)) {
      endpoints.set('cef', known);
      return { steamRunning: true, endpoint: known.endpoint, discovery: null };
    }
  }

  const byDefault = await probePort(DEFAULT_CEF_PORT);
  if (byDefault) {
    endpoints.set('cef', { pidKey, endpoint: byDefault });
    return { steamRunning: true, endpoint: byDefault, discovery: null };
  }

  const discovery =
    (await discoveries.fetch(pidKey, { forceRefresh: opts.fresh ?? false })) ??
    NO_DISCOVERY;
  if (discovery.kind === 'port' && discovery.port !== DEFAULT_CEF_PORT) {
    const found = await probePort(discovery.port);
    if (found) {
      console.log(`[SteamBridge] CDP found on ${found.host} port ${found.port}`);
      endpoints.set('cef', { pidKey, endpoint: found });
      return { steamRunning: true, endpoint: found, discovery };
    }
  }
  return { steamRunning: true, endpoint: null, discovery };
}

const CODE_ESCAPES: Record<string, string> = {
  '<': '\\u003C',
  '>': '\\u003E',
  '\u2028': '\\u2028',
  '\u2029': '\\u2029',
};

export function jsLiteral(value: unknown): string {
  const json = JSON.stringify(value) ?? 'null';
  return json.replace(/[<>\u2028\u2029]/g, (char) => CODE_ESCAPES[char]);
}

async function evaluateAt<T>(
  endpoint: CefEndpoint,
  expression: string,
  timeoutMs: number
): Promise<T> {
  const client = await pTimeout(
    CDP({
      host: endpoint.host,
      port: endpoint.port,
      // No first-target fallback: during startup races that would run the ops in a Steam window page.
      target: (targets) => {
        const target =
          targets.find((t) => t.title === TARGET_TITLE) ??
          targets.find((t) => t.url.startsWith(TARGET_URL_PREFIX));
        if (!target) {
          throw new Error('SharedJSContext not ready');
        }
        return target;
      },
    }),
    {
      milliseconds: CEF_CONNECT_TIMEOUT_MS,
      message: `CEF connect timed out after ${CEF_CONNECT_TIMEOUT_MS}ms`,
    }
  );

  try {
    const result = await pTimeout(
      client.Runtime.evaluate({
        // SteamClient rejects with plain objects that CDP describes as just "Object".
        expression: `(async () => {
          try {
            return await (${expression});
          } catch (e) {
            if (e instanceof Error) { throw e; }
            let m;
            try { m = JSON.stringify(e); } catch { m = undefined; }
            throw new Error(m === undefined ? String(e) : m);
          }
        })()`,
        awaitPromise: true,
        returnByValue: true,
      }),
      { milliseconds: timeoutMs, message: `CEF evaluate timed out after ${timeoutMs}ms` }
    );
    if (result.exceptionDetails) {
      const description =
        result.exceptionDetails.exception?.description ?? result.exceptionDetails.text;
      throw new Error(description.split('\n')[0].replace(/^Error: /, ''));
    }
    return result.result?.value as T;
  } finally {
    await client.close().catch(() => {
      // Closing an already-closed session throws; safe to ignore.
    });
  }
}

export async function invokeViaCdp<K extends SteamOpName>(
  op: K,
  args: SteamOps[K]['args'],
  timeoutMs: number = CEF_EVAL_TIMEOUT_MS
): Promise<SteamOps[K]['result']> {
  if (isPluginOnlyOp(op)) {
    throw new Error('plugin-only');
  }
  const { endpoint } = await resolveCefEndpoint();
  if (!endpoint) {
    throw new Error('cef-unavailable');
  }
  return evaluateAt<SteamOps[K]['result']>(
    endpoint,
    `(${STEAM_OPS_SOURCE})[${jsLiteral(op)}](${jsLiteral(args)})`,
    timeoutMs
  );
}
