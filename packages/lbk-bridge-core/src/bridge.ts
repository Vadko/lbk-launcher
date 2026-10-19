import { A, D, F, G, pipe, R } from '@mobily/ts-belt';
import pLimit from 'p-limit';
import pTimeout from 'p-timeout';
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
  type BridgeConfig,
  bridgeConfigSchema,
  hmacHex,
  type PluginFrame,
  type RequestFrame,
  safeEqual,
  serverFrameSchema,
  toHex,
} from './protocol';
import { type BridgeHandle, type SteamGlobals, steamGlobals } from './steam-globals';

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

// Reconnect backoff, achievements.json retries and the handshake and op timeouts run on env's clock via p-timeout.
export interface BridgeEnv
  extends Pick<WindowOrWorkerGlobalScope, 'setTimeout' | 'clearTimeout'> {
  steam: SteamGlobals;
  openSocket(url: string): BridgeSocket;
  fetch(
    url: string,
    init: RequestInit
  ): Promise<{ ok: boolean; json(): Promise<unknown> }>;
  crypto: Pick<Crypto, 'getRandomValues' | 'subtle'>;
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

// Wrapped in p-timeout, a promise that never settles is a timer on env's clock that can be cleared or aborted.
const neverSettles = (): Promise<void> => new Promise<void>(F.ignore);

// SteamClient rejects with plain objects like {result, message}; keep them readable like the CDP transport does.
function errText(e: unknown): string {
  if (G.isError(e)) {
    return e.message || String(e);
  }
  if (G.isObject(e) || G.isArray(e)) {
    return R.toUndefined(R.fromExecution(() => JSON.stringify(e))) ?? String(e);
  }
  return String(e);
}

export function createBridge({ host, dataBase, env }: BridgeOptions): Bridge {
  const life = new AbortController();
  const disposed = () => life.signal.aborted;
  const requests = pLimit(1);
  let socket: BridgeSocket | null = null;

  // Resolves after ms, or at once on dispose.
  const delay = (ms: number): Promise<void> =>
    pTimeout(neverSettles(), {
      milliseconds: ms,
      message: false,
      customTimers: env,
      signal: life.signal,
    }).catch(F.ignore);

  const readJson = async (name: string): Promise<unknown> => {
    const url = new URL(name, dataBase);
    url.searchParams.set('t', String(Date.now()));
    const r = await env.fetch(url.href, { cache: 'no-store' });
    return r.ok ? r.json() : null;
  };

  const spentDigest = (secret: string) => hmacHex(env.crypto.subtle, secret, 'spent');
  const readSpent = (): readonly string[] => {
    const list = R.toUndefined(
      R.fromExecution((): unknown =>
        JSON.parse(env.steam.localStorage?.getItem(SPENT_KEY) || '[]')
      )
    );
    return G.isArray(list) ? A.filter(list, G.isString) : [];
  };
  const rememberSpent = async (secret: string): Promise<void> => {
    const digest = await spentDigest(secret);
    const list = pipe(
      readSpent(),
      A.reject((d) => d === digest),
      A.append(digest),
      A.sliceToEnd(-SPENT_MAX)
    );
    env.steam.localStorage?.setItem(SPENT_KEY, JSON.stringify(list));
  };

  const achievements = createAchievements({
    steam: env.steam,
    readJson,
    delay,
    signal: life.signal,
    errText,
  });
  const handlers = new Map<string, (args: unknown) => Promise<unknown>>(
    D.toPairs({ ...createOps(env.steam), ...achievements.ops })
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

  const answer = async ({ id, op, args }: RequestFrame): Promise<PluginFrame> => {
    const handler = handlers.get(op);
    if (!handler) {
      return { t: 'res', id, ok: false, error: 'unknown op' };
    }
    try {
      const value = await pTimeout(handler(args || {}), {
        milliseconds: OP_TIMEOUT_MS,
        message: `timed out after ${OP_TIMEOUT_MS}ms`,
        customTimers: env,
      });
      return { t: 'res', id, ok: true, value: value ?? null };
    } catch (e) {
      return { t: 'res', id, ok: false, error: errText(e) };
    }
  };

  // Resolves once the socket closes, with whether LBK proved the secret first.
  const runSession = (cfg: BridgeConfig): Promise<boolean> =>
    new Promise<boolean>((resolve) => {
      state.status = 'connecting';
      const ws = env.openSocket(`ws://127.0.0.1:${cfg.port}${BRIDGE_WS_PATH}`);
      socket = ws;
      const cn = toHex(env.crypto.getRandomValues(new Uint8Array(16)));
      const proof = (message: string) => hmacHex(env.crypto.subtle, cfg.secret, message);
      let sn: string | null = null;
      let authed = false;
      const handshake = pTimeout(neverSettles(), {
        milliseconds: HANDSHAKE_TIMEOUT_MS,
        customTimers: env,
        fallback: () => ws.close(4000, 'handshake timeout'),
      });
      const send = (frame: PluginFrame): void => {
        if (ws.readyState === SOCKET_OPEN) {
          ws.send(JSON.stringify(frame));
        }
      };

      const onFrame = async (msg: unknown): Promise<void> => {
        if (!G.isObject(msg)) {
          ws.close(4001, 'bad message');
          return;
        }
        const frame = serverFrameSchema.safeParse(msg).data;
        if (authed) {
          if (frame?.t === 'ping') {
            send({ t: 'pong', id: frame.id });
          } else if (frame?.t === 'req') {
            void requests(async () => send(await answer(frame)));
          }
          return;
        }
        if (frame?.t === 'challenge' && sn === null) {
          if (!safeEqual(await proof(`server|${cn}|${frame.sn}`), frame.sp)) {
            ws.close(4003, 'server auth failed');
            return;
          }
          sn = frame.sn;
          send({ t: 'auth', cp: await proof(`client|${sn}|${cn}`) });
        } else if (frame?.t === 'ready' && sn !== null) {
          authed = true;
          handshake.clear();
          state.status = 'connected';
          state.connectedAt = Date.now();
        } else {
          ws.close(4002, 'unexpected message before auth');
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
      ws.onmessage = (ev) =>
        R.match(
          R.fromExecution((): unknown => JSON.parse(ev.data)),
          (msg) => void onFrame(msg),
          () => ws.close(4001, 'bad json')
        );
      ws.onerror = () => {
        state.lastError = 'socket error';
      };
      ws.onclose = () => {
        handshake.clear();
        if (socket === ws) {
          socket = null;
        }
        resolve(authed);
      };
    }).catch((e: unknown) => {
      state.lastError = errText(e);
      return false;
    });

  const transport = async (): Promise<void> => {
    // LBK writes a new secret whenever a session ends; a stale one means LBK is gone and its port may belong to someone else.
    let spentSecret: string | null = null;
    const readConfig = async (): Promise<BridgeConfig | null> => {
      const cfg = bridgeConfigSchema.safeParse(await readJson('bridge.json')).data;
      if (!cfg || cfg.secret === spentSecret) {
        return null;
      }
      return A.includes(readSpent(), await spentDigest(cfg.secret)) ? null : cfg;
    };

    let retryMs = RETRY_MIN_MS;
    while (!disposed()) {
      const cfg = await readConfig().catch((e: unknown) => {
        state.lastError = errText(e);
        return null;
      });
      if (cfg && !disposed() && (await runSession(cfg))) {
        spentSecret = cfg.secret;
        // Without localStorage the in-memory spentSecret still covers this Steam session.
        void rememberSpent(cfg.secret).catch(F.ignore);
        retryMs = RETRY_MIN_MS;
      }
      if (disposed()) {
        return;
      }
      state.status = 'waiting';
      await delay(retryMs);
      retryMs = Math.min(retryMs * 2, RETRY_MAX_MS);
    }
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
    achievements.start();
    void transport();
  };

  return { state, start, dispose };
}
