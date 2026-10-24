import type { BridgeHost, SteamOpName } from '@lbk/bridge-core/contract';
import type { WebSocket } from 'ws';
import {
  PluginBridgeError,
  type PluginHello,
  parseFrame,
  parseSessionMessage,
  type SessionMessage,
  sendFrame,
} from './protocol';

// The plugin runs ops one at a time and gives each up to 30 s, so a timed-out op still occupies its queue that long.
const STALE_OP_RELEASE_MS = 35000;
const PING_INTERVAL_MS = 15000;
const PONG_TIMEOUT_MS = 35000;
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

// One authenticated plugin connection; requests go out one at a time, matching the plugin's own chain.
export class PluginSession {
  readonly pluginVersion: string;
  readonly host: BridgeHost;
  readonly ops: ReadonlySet<string>;
  private readonly queue: QueuedRequest[] = [];
  private inFlight: InFlightRequest | null = null;
  private nextId = 1;
  private lastPongAt = Date.now();
  private pongWaiters: (() => void)[] = [];
  private readonly heartbeat: NodeJS.Timeout;
  private ended = false;

  constructor(
    private readonly ws: WebSocket,
    hello: PluginHello,
    private readonly onEnd: (session: PluginSession) => void
  ) {
    this.pluginVersion = hello.pv;
    this.host = hello.host;
    this.ops = new Set(hello.ops);
    this.heartbeat = setInterval(() => {
      if (Date.now() - this.lastPongAt > PONG_TIMEOUT_MS) {
        console.warn('[SteamBridge] Plugin stopped answering pings');
        ws.terminate();
        return;
      }
      sendFrame(ws, { t: 'ping', id: this.nextId++ });
    }, PING_INTERVAL_MS);
    ws.on('message', (data) => {
      const msg = parseSessionMessage(parseFrame(data));
      if (msg) {
        this.handle(msg);
      }
    });
  }

  invoke(op: SteamOpName, args: unknown, timeoutMs: number): Promise<unknown> {
    return new Promise((resolve, reject) => {
      this.queue.push({ op, args, timeoutMs, resolve, reject });
      this.pump();
    });
  }

  // bridge.json is readable beyond the plugin, so a newcomer with the secret only displaces a session that went quiet.
  ping(): Promise<boolean> {
    if (this.ws.readyState !== this.ws.OPEN) {
      return Promise.resolve(false);
    }
    return new Promise((resolve) => {
      const onPong = () => {
        clearTimeout(timer);
        resolve(true);
      };
      const timer = setTimeout(() => {
        this.pongWaiters = this.pongWaiters.filter((waiter) => waiter !== onPong);
        resolve(false);
      }, LIVENESS_PROBE_MS);
      this.pongWaiters.push(onPong);
      sendFrame(this.ws, { t: 'ping', id: this.nextId++ });
    });
  }

  close(code: number, reason: string): void {
    this.ws.close(code, reason);
  }

  // Idempotent; everything still waiting is rejected as disconnected.
  end(): void {
    if (this.ended) {
      return;
    }
    this.ended = true;
    clearInterval(this.heartbeat);
    if (this.inFlight) {
      clearTimeout(this.inFlight.timer);
      if (!this.inFlight.stale) {
        this.inFlight.request.reject(new PluginBridgeError('disconnected'));
      }
      this.inFlight = null;
    }
    for (const request of this.queue.splice(0)) {
      request.reject(new PluginBridgeError('disconnected'));
    }
    this.onEnd(this);
  }

  private handle(msg: SessionMessage): void {
    if (msg.t === 'pong') {
      this.lastPongAt = Date.now();
      for (const waiter of this.pongWaiters.splice(0)) {
        waiter();
      }
      return;
    }
    const inFlight = this.inFlight;
    if (!inFlight || msg.id !== inFlight.id) {
      return;
    }
    if (!inFlight.stale) {
      if (msg.ok) {
        inFlight.request.resolve(msg.value);
      } else {
        inFlight.request.reject(new PluginBridgeError('op-failed', msg.error));
      }
    }
    this.release(inFlight.id);
  }

  private pump(): void {
    if (this.inFlight || this.ended) {
      return;
    }
    const request = this.queue.shift();
    if (!request) {
      return;
    }
    const id = this.nextId++;
    if (!sendFrame(this.ws, { t: 'req', id, op: request.op, args: request.args })) {
      request.reject(new PluginBridgeError('disconnected'));
      this.pump();
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
          new PluginBridgeError(
            'timeout',
            `plugin op ${request.op} timed out after ${request.timeoutMs}ms`
          )
        );
        inFlight.timer = setTimeout(
          () => this.release(id),
          Math.max(0, sentAt + STALE_OP_RELEASE_MS - Date.now())
        );
      }, request.timeoutMs),
    };
    this.inFlight = inFlight;
  }

  private release(id: number): void {
    if (this.inFlight?.id !== id) {
      return;
    }
    clearTimeout(this.inFlight.timer);
    this.inFlight = null;
    this.pump();
  }
}
