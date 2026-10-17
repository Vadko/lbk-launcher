import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import { type RawData, WebSocket, WebSocketServer } from 'ws';
import { MILLENNIUM_PLUGIN_NAME } from '@/main/utils/millennium-plugin';
import { deleteBridgePluginData, writeBridgePluginData } from '@/main/utils/plugin-data';
import type { SteamOpName, SteamOps } from '@/main/utils/steam-bridge-ops';

const PROTOCOL_VERSION = 1;
const BRIDGE_PATH = '/lbk-bridge';
const ALLOWED_ORIGIN = 'https://steamloopback.host';
const MAX_PAYLOAD_BYTES = 32 * 1024 * 1024;
const HANDSHAKE_TIMEOUT_MS = 5000;
const DEFAULT_OP_TIMEOUT_MS = 15000;
// The plugin runs ops one at a time and gives each up to 30 s, so a timed-out op still occupies its queue that long.
const STALE_OP_RELEASE_MS = 35000;
const PING_INTERVAL_MS = 15000;
const PONG_TIMEOUT_MS = 35000;
const HEX32 = /^[0-9a-f]{32}$/;
const HEX64 = /^[0-9a-f]{64}$/;

const CLOSE_PROTOCOL = 4002;
const CLOSE_AUTH = 4003;
const CLOSE_HANDSHAKE_TIMEOUT = 4004;
const CLOSE_REPLACED = 4009;
const CLOSE_SHUTDOWN = 4010;
const CLOSE_BUSY = 4011;
const LIVENESS_PROBE_MS = 1500;

interface QueuedRequest {
  op: SteamOpName;
  args: unknown;
  timeoutMs: number;
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
}

interface InFlightRequest {
  id: number;
  request: QueuedRequest;
  stale: boolean;
  timer: NodeJS.Timeout;
}

type PluginHostKind = 'millennium' | 'decky';

interface PluginHello {
  pv: string;
  ops: string[];
  cn: string;
  host: PluginHostKind;
}

interface PluginSession {
  ws: WebSocket;
  pluginVersion: string;
  host: PluginHostKind;
  ops: Set<string>;
  queue: QueuedRequest[];
  inFlight: InFlightRequest | null;
  lastPongAt: number;
  pingTimer: NodeJS.Timeout | null;
  pongWaiters: (() => void)[];
}

interface ServerState {
  wss: WebSocketServer;
  port: number;
  secret: string;
}

let server: ServerState | null = null;
let starting: Promise<void> | null = null;
let session: PluginSession | null = null;
let nextMessageId = 1;
const connectionListeners = new Set<(connected: boolean) => void>();

export function computeServerProof(secretHex: string, cn: string, sn: string): string {
  return createHmac('sha256', Buffer.from(secretHex, 'hex'))
    .update(`server|${cn}|${sn}`)
    .digest('hex');
}

export function verifyClientProof(
  secretHex: string,
  sn: string,
  cn: string,
  cp: string
): boolean {
  if (!HEX64.test(cp)) {
    return false;
  }
  const expected = createHmac('sha256', Buffer.from(secretHex, 'hex'))
    .update(`client|${sn}|${cn}`)
    .digest();
  return timingSafeEqual(expected, Buffer.from(cp, 'hex'));
}

// Exact Host match blocks DNS rebinding; the Origin check keeps ordinary web pages out.
export function isAllowedUpgrade(
  headers: { origin?: string; host?: string },
  port: number
): boolean {
  return headers.origin === ALLOWED_ORIGIN && headers.host === `127.0.0.1:${port}`;
}

function setConnected(connected: boolean): void {
  for (const listener of connectionListeners) {
    try {
      listener(connected);
    } catch (error) {
      console.warn('[SteamBridge] Connection listener failed:', error);
    }
  }
}

export function onPluginConnectionChange(cb: (connected: boolean) => void): () => void {
  connectionListeners.add(cb);
  return () => {
    connectionListeners.delete(cb);
  };
}

export function isPluginConnected(): boolean {
  return session !== null;
}

export function getConnectedPluginInfo(): {
  pluginVersion: string;
  ops: string[];
  host: PluginHostKind;
} | null {
  return session
    ? { pluginVersion: session.pluginVersion, ops: [...session.ops], host: session.host }
    : null;
}

function send(ws: WebSocket, message: Record<string, unknown>): boolean {
  if (ws.readyState !== ws.OPEN) {
    return false;
  }
  ws.send(JSON.stringify(message));
  return true;
}

function parseMessage(data: RawData): Record<string, unknown> | null {
  try {
    const parsed: unknown = JSON.parse(data.toString());
    return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function pump(s: PluginSession): void {
  if (s.inFlight || s !== session) {
    return;
  }
  const request = s.queue.shift();
  if (!request) {
    return;
  }
  const id = nextMessageId++;
  if (!send(s.ws, { t: 'req', id, op: request.op, args: request.args })) {
    request.reject(new Error('plugin-disconnected'));
    pump(s);
    return;
  }
  const sentAt = Date.now();
  const inFlight: InFlightRequest = {
    id,
    request,
    stale: false,
    timer: setTimeout(() => {
      inFlight.stale = true;
      request.reject(
        new Error(`plugin op ${request.op} timed out after ${request.timeoutMs}ms`)
      );
      inFlight.timer = setTimeout(
        () => releaseInFlight(s, id),
        Math.max(0, sentAt + STALE_OP_RELEASE_MS - Date.now())
      );
    }, request.timeoutMs),
  };
  s.inFlight = inFlight;
}

function releaseInFlight(s: PluginSession, id: number): void {
  if (s.inFlight?.id !== id) {
    return;
  }
  clearTimeout(s.inFlight.timer);
  s.inFlight = null;
  pump(s);
}

function handleResponse(s: PluginSession, msg: Record<string, unknown>): void {
  const inFlight = s.inFlight;
  if (!inFlight || msg.id !== inFlight.id) {
    return;
  }
  if (!inFlight.stale) {
    if (msg.ok === true) {
      inFlight.request.resolve(msg.value);
    } else {
      inFlight.request.reject(
        new Error(typeof msg.error === 'string' ? msg.error : 'plugin op failed')
      );
    }
  }
  releaseInFlight(s, inFlight.id);
}

function endSession(s: PluginSession): void {
  if (s.pingTimer) {
    clearInterval(s.pingTimer);
  }
  if (s.inFlight) {
    clearTimeout(s.inFlight.timer);
    if (!s.inFlight.stale) {
      s.inFlight.request.reject(new Error('plugin-disconnected'));
    }
    s.inFlight = null;
  }
  for (const request of s.queue.splice(0)) {
    request.reject(new Error('plugin-disconnected'));
  }
  if (session === s) {
    session = null;
    console.log('[SteamBridge] Plugin disconnected');
    setConnected(false);
  }
}

// bridge.json is readable beyond the plugin, so a newcomer with the secret only displaces a session that went quiet.
function answersPing(s: PluginSession): Promise<boolean> {
  if (s.ws.readyState !== WebSocket.OPEN) {
    return Promise.resolve(false);
  }
  return new Promise((resolve) => {
    const onPong = () => {
      clearTimeout(timer);
      resolve(true);
    };
    const timer = setTimeout(() => {
      s.pongWaiters = s.pongWaiters.filter((waiter) => waiter !== onPong);
      resolve(false);
    }, LIVENESS_PROBE_MS);
    s.pongWaiters.push(onPong);
    send(s.ws, { t: 'ping', id: nextMessageId++ });
  });
}

function promote(ws: WebSocket, hello: PluginHello): void {
  const previous = session;
  const s: PluginSession = {
    ws,
    pluginVersion: hello.pv,
    host: hello.host,
    ops: new Set(hello.ops),
    queue: [],
    inFlight: null,
    lastPongAt: Date.now(),
    pingTimer: null,
    pongWaiters: [],
  };
  if (previous) {
    // Cleared first so the old socket's close does not report a disconnect.
    session = null;
    endSession(previous);
    previous.ws.close(CLOSE_REPLACED, 'replaced');
  }
  session = s;

  s.pingTimer = setInterval(() => {
    if (Date.now() - s.lastPongAt > PONG_TIMEOUT_MS) {
      console.warn('[SteamBridge] Plugin stopped answering pings');
      ws.terminate();
      return;
    }
    send(ws, { t: 'ping', id: nextMessageId++ });
  }, PING_INTERVAL_MS);

  ws.on('message', (data) => {
    const msg = parseMessage(data);
    if (!msg) {
      return;
    }
    if (msg.t === 'pong') {
      s.lastPongAt = Date.now();
      for (const waiter of s.pongWaiters.splice(0)) {
        waiter();
      }
      return;
    }
    if (msg.t === 'res') {
      handleResponse(s, msg);
    }
  });
  const owner = server;
  ws.on('close', () => {
    endSession(s);
    // A session of a server that has since been replaced must not touch the new server's secret.
    if (owner && server === owner) {
      rotateSecret();
    }
  });

  console.log(`[SteamBridge] Plugin ${hello.pv} connected with ${hello.ops.length} ops`);
  setConnected(true);
}

// Plugins before 1.1.0 send no host; they are all the Millennium build.
export function parseHello(msg: Record<string, unknown>): PluginHello | null {
  const { t, v, plugin, pv, ops, cn, host } = msg;
  if (host !== undefined && host !== 'millennium' && host !== 'decky') {
    return null;
  }
  if (
    t !== 'hello' ||
    v !== PROTOCOL_VERSION ||
    plugin !== MILLENNIUM_PLUGIN_NAME ||
    typeof pv !== 'string' ||
    pv.length > 64 ||
    !Array.isArray(ops) ||
    ops.length > 256 ||
    !ops.every((op): op is string => typeof op === 'string' && op.length <= 64) ||
    typeof cn !== 'string' ||
    !HEX32.test(cn)
  ) {
    return null;
  }
  return { pv, ops, cn, host: host ?? 'millennium' };
}

function publishBridgeData(state: ServerState): void {
  writeBridgePluginData('bridge.json', {
    v: PROTOCOL_VERSION,
    port: state.port,
    secret: state.secret,
  });
}

// The plugin never reuses a secret whose session ended, so a port taken over after an LBK crash gets no client.
function rotateSecret(): void {
  if (!server) {
    return;
  }
  server.secret = randomBytes(32).toString('hex');
  publishBridgeData(server);
}

function handleConnection(ws: WebSocket): void {
  let hello: PluginHello | null = null;
  let sn: string | null = null;
  let secret: string | null = null;
  const timer = setTimeout(
    () => ws.close(CLOSE_HANDSHAKE_TIMEOUT, 'handshake timeout'),
    HANDSHAKE_TIMEOUT_MS
  );

  const onHandshakeMessage = (data: RawData) => {
    const msg = parseMessage(data);
    if (!msg) {
      ws.close(CLOSE_PROTOCOL, 'bad message');
      return;
    }
    if (!hello) {
      hello = parseHello(msg);
      if (!hello) {
        console.warn(
          '[SteamBridge] Rejected plugin hello:',
          JSON.stringify(msg).slice(0, 200)
        );
        ws.close(CLOSE_PROTOCOL, 'bad hello');
        return;
      }
      if (!server) {
        ws.close(CLOSE_SHUTDOWN, 'server stopping');
        return;
      }
      secret = server.secret;
      sn = randomBytes(16).toString('hex');
      send(ws, { t: 'challenge', sn, sp: computeServerProof(secret, hello.cn, sn) });
      return;
    }
    if (
      msg.t !== 'auth' ||
      sn === null ||
      secret === null ||
      typeof msg.cp !== 'string' ||
      !verifyClientProof(secret, sn, hello.cn, msg.cp)
    ) {
      console.warn('[SteamBridge] Plugin failed authentication');
      ws.close(CLOSE_AUTH, 'auth failed');
      return;
    }
    clearTimeout(timer);
    ws.off('message', onHandshakeMessage);
    const verified = hello;
    const current = session;
    void (async () => {
      if (current && (await answersPing(current))) {
        console.warn(
          '[SteamBridge] Refusing a second plugin while the connected one answers'
        );
        ws.close(CLOSE_BUSY, 'session active');
        return;
      }
      if (ws.readyState !== WebSocket.OPEN || !send(ws, { t: 'ready' })) {
        return;
      }
      promote(ws, verified);
    })();
  };

  ws.on('message', onHandshakeMessage);
  ws.on('close', () => clearTimeout(timer));
  ws.on('error', (error) => {
    console.warn('[SteamBridge] Plugin socket error:', error.message);
  });
}

async function listen(): Promise<void> {
  let port = 0;
  const wss = new WebSocketServer({
    host: '127.0.0.1',
    port: 0,
    path: BRIDGE_PATH,
    maxPayload: MAX_PAYLOAD_BYTES,
    verifyClient: (info, cb) => {
      if (isAllowedUpgrade({ origin: info.origin, host: info.req.headers.host }, port)) {
        cb(true);
        return;
      }
      console.warn(
        `[SteamBridge] Refused upgrade from origin=${info.origin} host=${info.req.headers.host}`
      );
      cb(false, 403);
    },
  });

  await once(wss, 'listening');
  wss.on('error', (error) => {
    console.warn('[SteamBridge] Server error:', error.message);
  });
  wss.on('connection', (ws) => handleConnection(ws));

  port = (wss.address() as AddressInfo).port;
  server = { wss, port, secret: randomBytes(32).toString('hex') };
  publishBridgeData(server);
  console.log(`[SteamBridge] Plugin server listening on 127.0.0.1:${port}`);
}

export async function startSteamBridgeServer(): Promise<void> {
  if (server) {
    return;
  }
  if (!starting) {
    starting = listen().finally(() => {
      starting = null;
    });
  }
  await starting;
}

// A crashed LBK never deleted its bridge.json; the plugin would keep dialing that port for anyone who binds it.
export function deleteStaleBridgeData(): void {
  if (!server && !starting) {
    deleteBridgePluginData('bridge.json');
  }
}

export async function stopSteamBridgeServer(): Promise<void> {
  deleteBridgePluginData('bridge.json');
  if (starting) {
    await starting.catch(() => undefined);
  }
  const current = server;
  if (!current) {
    return;
  }
  server = null;
  if (session) {
    session.ws.close(CLOSE_SHUTDOWN, 'server stopping');
    endSession(session);
  }
  for (const client of current.wss.clients) {
    client.terminate();
  }
  await new Promise<void>((resolve) => current.wss.close(() => resolve()));
  console.log('[SteamBridge] Plugin server stopped');
}

export function invokeViaPlugin<K extends SteamOpName>(
  op: K,
  args: SteamOps[K]['args'],
  timeoutMs: number = DEFAULT_OP_TIMEOUT_MS
): Promise<SteamOps[K]['result']> {
  const s = session;
  if (!s) {
    return Promise.reject(new Error('plugin-not-connected'));
  }
  if (!s.ops.has(op)) {
    return Promise.reject(new Error('plugin-outdated'));
  }
  return new Promise<SteamOps[K]['result']>((resolve, reject) => {
    s.queue.push({
      op,
      args,
      timeoutMs,
      resolve: (value) => resolve(value as SteamOps[K]['result']),
      reject,
    });
    pump(s);
  });
}
