import { createAchievements } from './achievements';
import {
  type AchievementsHookReport,
  BRIDGE_PLUGIN_NAME,
  BRIDGE_PROTOCOL,
  BRIDGE_VERSION,
  BRIDGE_WS_PATH,
  type BridgeHost,
} from './contract';
import { createOps } from './ops';
import {
  bridgeConfigSchema,
  challengeFrameSchema,
  hmacHex,
  type PluginFrame,
  pingFrameSchema,
  readyFrameSchema,
  requestFrameSchema,
  safeEqual,
  toHex,
} from './protocol';
import {
  type BridgeHandle,
  isRecord,
  type SteamGlobals,
  steamGlobals,
} from './steam-globals';

const RETRY_MIN_MS = 2000;
// LBK often starts long after Steam, and until the plugin dials in every bridge op waits or fails.
const RETRY_MAX_MS = 10000;
const HANDSHAKE_TIMEOUT_MS = 5000;
const OP_TIMEOUT_MS = 30000;
const SOCKET_OPEN = 1;
// localStorage outlives a Steam restart: after an LBK crash the stale bridge.json still holds a secret whose session ended.
const SPENT_KEY = 'lbk-bridge-spent-secrets';
const SPENT_MAX = 8;

export interface BridgeSocket {
  readonly readyState: number;
  send(data: string): void;
  close(code?: number, reason?: string): void;
  onopen: ((ev: Event) => void) | null;
  onmessage: ((ev: MessageEvent) => void) | null;
  onerror: ((ev: Event) => void) | null;
  onclose: ((ev: CloseEvent) => void) | null;
}

export interface BridgeEnv {
  steam: SteamGlobals;
  openSocket(url: string): BridgeSocket;
  fetch(
    url: string,
    init: RequestInit
  ): Promise<{ ok: boolean; json(): Promise<unknown> }>;
  crypto: Pick<Crypto, 'getRandomValues' | 'subtle'>;
  setTimeout(fn: () => void, ms: number): number;
  clearTimeout(handle: number): void;
}

interface BridgeState extends BridgeHandle {
  host: BridgeHost;
  version: string;
  status: 'idle' | 'waiting' | 'connecting' | 'connected' | 'disposed';
  idle: boolean;
  connectedAt: number | null;
  lastError: string | null;
  achievements: () => AchievementsHookReport;
  dispose: () => void;
}

export interface Bridge {
  state: BridgeState;
  start(): void;
  dispose(): void;
}

interface BridgeOptions {
  host: BridgeHost;
  dataBase: URL;
  env: BridgeEnv;
}

export function browserEnv(): BridgeEnv {
  return {
    steam: steamGlobals(),
    openSocket: (url) => new WebSocket(url),
    fetch: (url, init) => fetch(url, init),
    crypto,
    setTimeout: (fn, ms) => setTimeout(fn, ms),
    clearTimeout: (handle) => clearTimeout(handle),
  };
}

// SteamClient rejects with plain objects like {result, message}; keep them readable like the CDP transport does.
function errText(e: unknown): string {
  if (e instanceof Error) {
    return e.message || String(e);
  }
  if (e && typeof e === 'object') {
    try {
      return JSON.stringify(e);
    } catch {
      return String(e);
    }
  }
  return String(e);
}

export function createBridge({ host, dataBase, env }: BridgeOptions): Bridge {
  const life = new AbortController();
  const disposed = () => life.signal.aborted;
  let socket: BridgeSocket | null = null;

  const later = (fn: () => void, ms: number): (() => void) => {
    const cancel = () => {
      env.clearTimeout(handle);
      life.signal.removeEventListener('abort', cancel);
    };
    const handle = env.setTimeout(() => {
      cancel();
      if (!disposed()) {
        fn();
      }
    }, ms);
    life.signal.addEventListener('abort', cancel);
    return cancel;
  };
  const sleep = (ms: number) =>
    new Promise<void>((resolve) => {
      env.setTimeout(resolve, ms);
    });
  const withTimeout = <T>(p: Promise<T>, ms: number): Promise<T> =>
    Promise.race([
      p,
      sleep(ms).then(() => {
        throw new Error(`timed out after ${ms}ms`);
      }),
    ]);

  const readJson = async (name: string): Promise<unknown> => {
    const url = new URL(name, dataBase);
    url.searchParams.set('t', String(Date.now()));
    const r = await env.fetch(url.href, { cache: 'no-store' });
    return r.ok ? r.json() : null;
  };

  const spentDigest = (secret: string) => hmacHex(env.crypto.subtle, secret, 'spent');
  const readSpent = (): string[] => {
    try {
      const list: unknown = JSON.parse(
        env.steam.localStorage?.getItem(SPENT_KEY) || '[]'
      );
      return Array.isArray(list) ? list.filter((d) => typeof d === 'string') : [];
    } catch {
      return [];
    }
  };
  const rememberSpent = async (secret: string): Promise<void> => {
    try {
      const digest = await spentDigest(secret);
      const list = readSpent().filter((d) => d !== digest);
      list.push(digest);
      env.steam.localStorage?.setItem(SPENT_KEY, JSON.stringify(list.slice(-SPENT_MAX)));
    } catch {
      // No localStorage: the in-memory guard still covers this Steam session.
    }
  };

  const achievements = createAchievements({
    steam: env.steam,
    readJson,
    sleep,
    isDisposed: disposed,
    errText,
  });
  const handlers = new Map<string, (args: unknown) => Promise<unknown>>(
    Object.entries({ ...createOps(env.steam), ...achievements.ops })
  );

  const state: BridgeState = {
    host,
    version: BRIDGE_VERSION,
    status: 'idle',
    idle: false,
    connectedAt: null,
    lastError: null,
    achievements: () => achievements.report(),
    dispose: () => dispose(),
  };

  const startTransport = (): void => {
    let retryMs = RETRY_MIN_MS;
    let chain = Promise.resolve();
    // LBK writes a new secret whenever a session ends; a stale one means LBK is gone and its port may belong to someone else.
    let spentSecret: string | null = null;
    const schedule = (): void => {
      if (disposed()) {
        return;
      }
      state.status = 'waiting';
      later(() => void connect(), retryMs);
      retryMs = Math.min(retryMs * 2, RETRY_MAX_MS);
    };

    async function connect(): Promise<void> {
      let raw: unknown = null;
      try {
        raw = await readJson('bridge.json');
      } catch (e) {
        state.lastError = errText(e);
      }
      if (disposed()) {
        return;
      }
      const cfg = bridgeConfigSchema.safeParse(raw).data;
      if (!cfg || cfg.secret === spentSecret) {
        schedule();
        return;
      }
      if (readSpent().includes(await spentDigest(cfg.secret))) {
        if (!disposed()) {
          schedule();
        }
        return;
      }

      state.status = 'connecting';
      let ws: BridgeSocket;
      try {
        ws = env.openSocket(`ws://127.0.0.1:${cfg.port}${BRIDGE_WS_PATH}`);
      } catch (e) {
        state.lastError = errText(e);
        schedule();
        return;
      }
      socket = ws;
      const cn = toHex(env.crypto.getRandomValues(new Uint8Array(16)));
      let sn: string | null = null;
      let authed = false;
      const cancelHandshakeTimeout = later(
        () => ws.close(4000, 'handshake timeout'),
        HANDSHAKE_TIMEOUT_MS
      );
      const send = (frame: PluginFrame): void => {
        if (ws.readyState === SOCKET_OPEN) {
          ws.send(JSON.stringify(frame));
        }
      };

      ws.onopen = () =>
        send({
          t: 'hello',
          v: BRIDGE_PROTOCOL,
          plugin: BRIDGE_PLUGIN_NAME,
          pv: BRIDGE_VERSION,
          host,
          ops: [...handlers.keys()],
          cn,
        });

      ws.onmessage = async (ev) => {
        let msg: unknown;
        try {
          msg = JSON.parse(ev.data);
        } catch {
          ws.close(4001, 'bad json');
          return;
        }
        if (!isRecord(msg)) {
          ws.close(4001, 'bad message');
          return;
        }
        if (!authed) {
          const challenge =
            sn === null ? challengeFrameSchema.safeParse(msg).data : undefined;
          if (challenge) {
            const expected = await hmacHex(
              env.crypto.subtle,
              cfg.secret,
              `server|${cn}|${challenge.sn}`
            );
            if (!safeEqual(expected, challenge.sp)) {
              ws.close(4003, 'server auth failed');
              return;
            }
            sn = challenge.sn;
            send({
              t: 'auth',
              cp: await hmacHex(env.crypto.subtle, cfg.secret, `client|${sn}|${cn}`),
            });
            return;
          }
          if (sn !== null && readyFrameSchema.safeParse(msg).success) {
            authed = true;
            cancelHandshakeTimeout();
            retryMs = RETRY_MIN_MS;
            state.status = 'connected';
            state.connectedAt = Date.now();
            return;
          }
          ws.close(4002, 'unexpected message before auth');
          return;
        }
        const ping = pingFrameSchema.safeParse(msg).data;
        if (ping) {
          send({ t: 'pong', id: ping.id });
          return;
        }
        const req = requestFrameSchema.safeParse(msg).data;
        if (!req) {
          return;
        }
        chain = chain.then(async () => {
          const handler = handlers.get(req.op);
          if (!handler) {
            send({ t: 'res', id: req.id, ok: false, error: 'unknown op' });
            return;
          }
          try {
            const value = await withTimeout(handler(req.args || {}), OP_TIMEOUT_MS);
            send({
              t: 'res',
              id: req.id,
              ok: true,
              value: value === undefined ? null : value,
            });
          } catch (e) {
            send({ t: 'res', id: req.id, ok: false, error: errText(e) });
          }
        });
      };

      ws.onerror = () => {
        state.lastError = 'socket error';
      };
      ws.onclose = () => {
        cancelHandshakeTimeout();
        if (authed) {
          spentSecret = cfg.secret;
          void rememberSpent(cfg.secret);
        }
        if (socket === ws) {
          socket = null;
        }
        schedule();
      };
    }

    void connect();
  };

  function dispose(): void {
    if (disposed()) {
      return;
    }
    life.abort();
    state.status = 'disposed';
    const ws = socket;
    socket = null;
    if (ws) {
      try {
        ws.close(1000, 'disposed');
      } catch {
        // Already closing.
      }
    }
    achievements.dispose();
    if (env.steam.__LBK_BRIDGE__ === state) {
      delete env.steam.__LBK_BRIDGE__;
    }
  }

  // One copy per SharedJSContext: a reload replaces its own host's copy, and Millennium's copy wins over Decky's.
  const start = (): void => {
    if (disposed() || env.steam.__LBK_BRIDGE__ === state) {
      return;
    }
    const prev = env.steam.__LBK_BRIDGE__;
    if (prev) {
      if (prev.host !== host && host !== 'millennium') {
        state.idle = true;
        return;
      }
      try {
        prev.dispose?.();
      } catch (e) {
        console.warn('[LBK] previous bridge dispose', e);
      }
    }
    env.steam.__LBK_BRIDGE__ = state;
    void achievements.start();
    startTransport();
  };

  return { state, start, dispose };
}
