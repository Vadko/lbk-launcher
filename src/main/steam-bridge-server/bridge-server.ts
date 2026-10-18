import { randomBytes } from 'node:crypto';
import { once } from 'node:events';
import { createServer, type IncomingMessage, type Server, STATUS_CODES } from 'node:http';
import type { Duplex } from 'node:stream';
import {
  BRIDGE_PROTOCOL,
  BRIDGE_WS_PATH,
  type BridgeHost,
  type SteamOpName,
  type SteamOps,
} from '@lbk/bridge-core/contract';
import pLimit from 'p-limit';
import { type RawData, type WebSocket, WebSocketServer } from 'ws';
import { appEvents } from '@/main/app-events';
import { deleteBridgePluginData, writeBridgePluginData } from '@/main/utils/plugin-data';
import { PluginSession } from './plugin-session';
import {
  CloseCode,
  computeServerProof,
  isAllowedUpgrade,
  PluginBridgeError,
  type PluginHello,
  parseAuthProof,
  parseFrame,
  parseHello,
  sendFrame,
  verifyClientProof,
} from './protocol';

const MAX_PAYLOAD_BYTES = 32 * 1024 * 1024;
const HANDSHAKE_TIMEOUT_MS = 5000;
const DEFAULT_OP_TIMEOUT_MS = 15000;

type Handshake =
  | { stage: 'hello' }
  | { stage: 'auth'; hello: PluginHello; sn: string; secret: string }
  | { stage: 'done' };

function newSecret(): string {
  return randomBytes(32).toString('hex');
}

function refuseUpgrade(socket: Duplex, status: number): void {
  const body = STATUS_CODES[status] ?? '';
  socket.end(
    `HTTP/1.1 ${status} ${body}\r\nConnection: close\r\nContent-Type: text/plain\r\nContent-Length: ${Buffer.byteLength(body)}\r\n\r\n${body}`
  );
}

class BridgeServer {
  private secret = newSecret();
  private session: PluginSession | null = null;
  private stopped = false;

  private constructor(
    private readonly http: Server,
    private readonly wss: WebSocketServer,
    readonly port: number
  ) {}

  static async listen(): Promise<BridgeServer> {
    // Plain HTTP gets the same 426 the ws module's own server answers.
    const http = createServer((_req, res) => {
      res.writeHead(426, { 'Content-Type': 'text/plain' });
      res.end(STATUS_CODES[426]);
    });
    const wss = new WebSocketServer({
      noServer: true,
      path: BRIDGE_WS_PATH,
      maxPayload: MAX_PAYLOAD_BYTES,
    });
    http.listen(0, '127.0.0.1');
    await once(http, 'listening');
    const address = http.address();
    if (address === null || typeof address === 'string') {
      http.close();
      throw new Error(`bridge server bound to ${address}, expected a TCP port`);
    }
    const server = new BridgeServer(http, wss, address.port);
    http.on('error', (error) => {
      console.warn('[SteamBridge] Server error:', error.message);
    });
    http.on('upgrade', (req, socket, head) => server.upgrade(req, socket, head));
    server.publish();
    console.log(`[SteamBridge] Plugin server listening on 127.0.0.1:${address.port}`);
    return server;
  }

  current(): PluginSession | null {
    return this.session;
  }

  async stop(): Promise<void> {
    this.stopped = true;
    const session = this.session;
    if (session) {
      session.close(CloseCode.shutdown, 'server stopping');
      session.end();
    }
    for (const client of this.wss.clients) {
      client.terminate();
    }
    await new Promise<void>((resolve) => this.wss.close(() => resolve()));
    await new Promise<void>((resolve) => this.http.close(() => resolve()));
    console.log('[SteamBridge] Plugin server stopped');
  }

  private publish(): void {
    writeBridgePluginData('bridge.json', {
      v: BRIDGE_PROTOCOL,
      port: this.port,
      secret: this.secret,
    });
  }

  // The plugin never reuses a secret whose session ended, so a port taken over after an LBK crash gets no client.
  private rotateSecret(): void {
    if (this.stopped) {
      return;
    }
    this.secret = newSecret();
    this.publish();
  }

  private upgrade(req: IncomingMessage, socket: Duplex, head: Buffer): void {
    socket.on('error', () => socket.destroy());
    const { origin, host } = req.headers;
    if (!isAllowedUpgrade({ origin, host }, this.port)) {
      console.warn(`[SteamBridge] Refused upgrade from origin=${origin} host=${host}`);
      refuseUpgrade(socket, 403);
      return;
    }
    this.wss.handleUpgrade(req, socket, head, (ws) => this.handshake(ws));
  }

  private handshake(ws: WebSocket): void {
    let state: Handshake = { stage: 'hello' };
    const timer = setTimeout(
      () => ws.close(CloseCode.handshakeTimeout, 'handshake timeout'),
      HANDSHAKE_TIMEOUT_MS
    );

    const onMessage = (data: RawData) => {
      const msg = parseFrame(data);
      if (!msg) {
        ws.close(CloseCode.protocol, 'bad message');
        return;
      }
      if (state.stage === 'hello') {
        const hello = parseHello(msg);
        if (!hello) {
          console.warn(
            '[SteamBridge] Rejected plugin hello:',
            JSON.stringify(msg).slice(0, 200)
          );
          ws.close(CloseCode.protocol, 'bad hello');
          return;
        }
        if (this.stopped) {
          ws.close(CloseCode.shutdown, 'server stopping');
          return;
        }
        const sn = randomBytes(16).toString('hex');
        state = { stage: 'auth', hello, sn, secret: this.secret };
        sendFrame(ws, {
          t: 'challenge',
          sn,
          sp: computeServerProof(state.secret, hello.cn, sn),
        });
        return;
      }
      if (state.stage !== 'auth') {
        return;
      }
      const cp = parseAuthProof(msg);
      if (cp === null || !verifyClientProof(state.secret, state.sn, state.hello.cn, cp)) {
        console.warn('[SteamBridge] Plugin failed authentication');
        ws.close(CloseCode.auth, 'auth failed');
        return;
      }
      clearTimeout(timer);
      ws.off('message', onMessage);
      const { hello } = state;
      state = { stage: 'done' };
      this.admit(ws, hello).catch((error: unknown) => {
        console.warn('[SteamBridge] Plugin handshake failed:', error);
      });
    };

    ws.on('message', onMessage);
    ws.on('close', () => clearTimeout(timer));
    ws.on('error', (error) => {
      console.warn('[SteamBridge] Plugin socket error:', error.message);
    });
  }

  private async admit(ws: WebSocket, hello: PluginHello): Promise<void> {
    const current = this.session;
    if (current && (await current.ping())) {
      console.warn(
        '[SteamBridge] Refusing a second plugin while the connected one answers'
      );
      ws.close(CloseCode.busy, 'session active');
      return;
    }
    if (ws.readyState !== ws.OPEN || !sendFrame(ws, { t: 'ready' })) {
      return;
    }
    this.promote(ws, hello);
  }

  private promote(ws: WebSocket, hello: PluginHello): void {
    const previous = this.session;
    if (previous) {
      // Cleared first so the old session's end does not report a disconnect.
      this.session = null;
      previous.end();
      previous.close(CloseCode.replaced, 'replaced');
    }
    const session = new PluginSession(ws, hello, (ended) => this.ended(ended));
    this.session = session;
    ws.on('close', () => {
      session.end();
      this.rotateSecret();
    });
    console.log(
      `[SteamBridge] Plugin ${hello.pv} connected with ${hello.ops.length} ops`
    );
    appEvents.emit('plugin-connection', true);
  }

  private ended(session: PluginSession): void {
    if (this.session !== session) {
      return;
    }
    this.session = null;
    console.log('[SteamBridge] Plugin disconnected');
    appEvents.emit('plugin-connection', false);
  }
}

let server: BridgeServer | null = null;
// Start and stop run one at a time, so a stop issued mid-start closes the server that start opens.
const lifecycle = pLimit(1);
let shuttingDown = false;

export function isPluginConnected(): boolean {
  return server?.current() != null;
}

export function getConnectedPluginInfo(): {
  pluginVersion: string;
  ops: string[];
  host: BridgeHost;
} | null {
  const session = server?.current();
  return session
    ? { pluginVersion: session.pluginVersion, ops: [...session.ops], host: session.host }
    : null;
}

export function startSteamBridgeServer(): Promise<void> {
  return lifecycle(async () => {
    if (!server && !shuttingDown) {
      server = await BridgeServer.listen();
    }
  });
}

// A crashed LBK never deleted its bridge.json; the plugin would keep dialing that port for anyone who binds it.
export function deleteStaleBridgeData(): void {
  if (!server && lifecycle.activeCount + lifecycle.pendingCount === 0) {
    deleteBridgePluginData('bridge.json');
  }
}

async function closeServer(): Promise<void> {
  const current = server;
  if (!current) {
    return;
  }
  // Again: a start that finished after the stop was requested has rewritten it.
  deleteBridgePluginData('bridge.json');
  server = null;
  await current.stop();
}

export function stopSteamBridgeServer(): Promise<void> {
  deleteBridgePluginData('bridge.json');
  return lifecycle(closeServer);
}

// Final: the disconnect it causes refreshes the status, and a start queued then must not rewrite bridge.json.
export function shutdownSteamBridgeServer(): Promise<void> {
  shuttingDown = true;
  return stopSteamBridgeServer();
}

export function invokeViaPlugin<K extends SteamOpName>(
  op: K,
  args: SteamOps[K]['args'],
  timeoutMs: number = DEFAULT_OP_TIMEOUT_MS
): Promise<SteamOps[K]['result']> {
  const session = server?.current();
  if (!session) {
    return Promise.reject(new PluginBridgeError('not-connected'));
  }
  if (!session.ops.has(op)) {
    return Promise.reject(new PluginBridgeError('outdated'));
  }
  // The wire carries no type: the plugin answers with what its op returns for these args.
  return session.invoke(op, args, timeoutMs) as Promise<SteamOps[K]['result']>;
}
