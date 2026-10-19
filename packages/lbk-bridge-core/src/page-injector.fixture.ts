import { vi } from 'vitest';
import type { AppStrings } from './achievement-text';
import { createPageInjector } from './page-injector';
import type { BridgeSocket } from './socket';

export const BROWSER = 'ws://127.0.0.1:8080/devtools/browser/0a1b-2c3d';
export const SCRIPT = '/* the page module */';
export const PORTAL2: AppStrings = { 'ACH.SURVIVE_CONTAINER_RIDE': { name: 'Підйом' } };
export const COMMUNITY = 'https://steamcommunity.com/achievements/620';
const ADD_SCRIPT = 'Page.addScriptToEvaluateOnNewDocument';

interface Sent {
  id: number;
  method: string;
  params: Record<string, unknown>;
  sessionId?: string;
}

// Plays Steam CEF's side of the browser socket.
export class FakeCdp implements BridgeSocket {
  readyState = 0;
  sent: Sent[] = [];
  onopen: ((ev: Event) => void) | null = null;
  onmessage: ((ev: MessageEvent) => void) | null = null;
  onerror: ((ev: Event) => void) | null = null;
  onclose: ((ev: CloseEvent) => void) | null = null;
  constructor(readonly url: string) {}
  send(data: string): void {
    this.sent.push(JSON.parse(data));
  }
  close(): void {
    this.readyState = 3;
  }
  open(): void {
    this.readyState = 1;
    this.onopen?.(new Event('open'));
  }
  drop(): void {
    this.readyState = 3;
    this.onclose?.(new CloseEvent('close'));
  }
  emit(method: string, params: object, sessionId?: string): void {
    const data = JSON.stringify(
      sessionId ? { method, params, sessionId } : { method, params }
    );
    this.onmessage?.(new MessageEvent('message', { data }));
  }
  methods(sessionId?: string): string[] {
    return this.sent.filter((c) => c.sessionId === sessionId).map((c) => c.method);
  }
  find(method: string, sessionId?: string): Sent[] {
    return this.sent.filter((c) => c.method === method && c.sessionId === sessionId);
  }
  // Answers every command of this kind (the injector drops answers it no longer waits for); a new script gets its own identifier.
  reply(method: string, result: object = {}, sessionId?: string): void {
    for (const { id } of this.find(method, sessionId)) {
      this.deliver(id, {
        result: method === ADD_SCRIPT ? { identifier: `script-${id}` } : result,
      });
    }
  }
  fail(method: string, sessionId?: string): void {
    for (const { id } of this.find(method, sessionId)) {
      this.deliver(id, { error: { message: 'No target with given id found' } });
    }
  }
  private deliver(id: number, answer: object): void {
    this.onmessage?.(
      new MessageEvent('message', { data: JSON.stringify({ id, ...answer }) })
    );
  }
}

export const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

export function injectorHarness(version: unknown = { webSocketDebuggerUrl: BROWSER }) {
  const sockets: FakeCdp[] = [];
  const timers = new Map<number, { fn: TimerHandler; ms: number | undefined }>();
  let nextTimer = 0;
  const fetchJson = vi.fn((_url: string) => Promise.resolve(version));
  const strings = vi.fn((appid: string) =>
    Promise.resolve(appid === '620' ? PORTAL2 : undefined)
  );
  const injector = createPageInjector({
    env: {
      fetchJson,
      openSocket: (url) => {
        const socket = new FakeCdp(url);
        sockets.push(socket);
        return socket;
      },
      setTimeout: (fn, ms) => {
        nextTimer++;
        timers.set(nextTimer, { fn, ms });
        return nextTimer;
      },
      clearTimeout: (handle) => {
        if (handle !== undefined) {
          timers.delete(handle);
        }
      },
    },
    script: SCRIPT,
    strings,
  });
  const cdp = () => {
    const socket = sockets.at(-1);
    if (!socket) {
      throw new Error('no CDP socket');
    }
    return socket;
  };
  // pTimeout arms a timer for every CDP command; the retry delay is the one longer than a second.
  const retries = () =>
    [...timers.values()].map(({ ms }) => ms).filter((ms) => ms !== 10_000);
  return {
    injector,
    fetchJson,
    strings,
    sockets,
    cdp,
    retries,
    async runRetry() {
      for (const [id, { fn, ms }] of timers) {
        if (ms !== 10_000 && typeof fn === 'function') {
          timers.delete(id);
          fn();
        }
      }
      await settle();
    },
    async connect() {
      injector.start();
      await settle();
      cdp().open();
      cdp().reply('Target.setDiscoverTargets');
      await settle();
      return cdp();
    },
    // Announces a target and plays Chrome's side of the attach and the session set-up.
    async attach(targetId: string, url = COMMUNITY, type = 'page') {
      const ws = cdp();
      ws.emit('Target.targetCreated', { targetInfo: { targetId, type, url } });
      ws.reply('Target.attachToTarget', { sessionId: `S${targetId}` });
      await settle();
      const sessionId = `S${targetId}`;
      for (const method of ws.methods(sessionId)) {
        ws.reply(method, {}, sessionId);
      }
      await settle();
      return sessionId;
    },
  };
}
