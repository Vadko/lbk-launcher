import { describe, expect, it } from 'vitest';
import { type BridgeEnv, type BridgeSocket, createBridge } from './bridge';
import type { BridgeHost } from './contract';
import { hmacHex } from './protocol';
import type { SteamGlobals } from './steam-globals';

class FakeSocket implements BridgeSocket {
  static instances: FakeSocket[] = [];
  readyState = 1;
  sent: Record<string, unknown>[] = [];
  closed = false;
  onopen: ((ev: Event) => void) | null = null;
  onmessage: ((ev: MessageEvent) => void) | null = null;
  onerror: ((ev: Event) => void) | null = null;
  onclose: ((ev: CloseEvent) => void) | null = null;
  constructor(readonly url: string) {
    FakeSocket.instances.push(this);
  }
  send(data: string): void {
    this.sent.push(JSON.parse(data));
  }
  close(): void {
    this.closed = true;
  }
}

function makeStorage(): Pick<Storage, 'getItem' | 'setItem'> {
  const items = new Map<string, string>();
  return {
    getItem: (key) => items.get(key) ?? null,
    setItem: (key, value) => void items.set(key, value),
  };
}

function makeSteam(bridgeJson: unknown = null, localStorage = makeStorage()) {
  const timers = new Map<number, () => void>();
  let nextTimer = 0;
  let fetches = 0;
  const steam: SteamGlobals = { localStorage };
  steam.window = steam;
  const env: BridgeEnv = {
    steam,
    openSocket: (url) => new FakeSocket(url),
    fetch: () => {
      fetches++;
      return Promise.resolve({
        ok: bridgeJson !== null,
        json: () => Promise.resolve(bridgeJson),
      });
    },
    crypto: globalThis.crypto,
    setTimeout: (fn) => {
      nextTimer++;
      timers.set(nextTimer, fn);
      return nextTimer;
    },
    clearTimeout: (handle) => {
      timers.delete(handle);
    },
  };
  const dataBase = new URL('http://127.0.0.1:1337/plugins/LBK%20Bridge/data/');
  return {
    steam,
    fetches: () => fetches,
    load: (host: BridgeHost) => createBridge({ host, dataBase, env }),
    runTimers() {
      const pending = [...timers.values()];
      timers.clear();
      for (const fn of pending) {
        fn();
      }
    },
  };
}

// connect() awaits WebCrypto before it dials.
const settle = () => new Promise((resolve) => setTimeout(resolve, 20));

const frame = (data: unknown) =>
  new MessageEvent('message', { data: JSON.stringify(data) });

describe('LBK Bridge double-load guard', () => {
  it('replaces its own earlier copy on a reload', () => {
    const steam = makeSteam();
    const first = steam.load('millennium');
    first.start();
    expect(steam.steam.__LBK_BRIDGE__).toBe(first.state);

    const second = steam.load('millennium');
    second.start();
    expect(first.state.status).toBe('disposed');
    expect(second.state.idle).toBe(false);
    expect(steam.steam.__LBK_BRIDGE__).toBe(second.state);
  });

  it('keeps the Decky copy idle while Millennium runs the bridge', () => {
    const steam = makeSteam();
    const millennium = steam.load('millennium');
    millennium.start();
    const decky = steam.load('decky');
    decky.start();
    expect(decky.state.idle).toBe(true);
    expect(millennium.state.status).not.toBe('disposed');
    expect(steam.steam.__LBK_BRIDGE__).toBe(millennium.state);

    decky.dispose();
    expect(steam.steam.__LBK_BRIDGE__).toBe(millennium.state);
  });

  it('lets Millennium take over from a running Decky copy', () => {
    const steam = makeSteam();
    const decky = steam.load('decky');
    decky.start();
    const millennium = steam.load('millennium');
    millennium.start();
    expect(decky.state.status).toBe('disposed');
    expect(steam.steam.__LBK_BRIDGE__).toBe(millennium.state);
    expect(millennium.state.host).toBe('millennium');
  });

  it('stops reconnecting once disposed', async () => {
    const steam = makeSteam();
    const copy = steam.load('decky');
    copy.start();
    await settle();
    const fetches = steam.fetches();
    expect(fetches).toBeGreaterThan(0);

    copy.dispose();
    expect(steam.steam.__LBK_BRIDGE__).toBeUndefined();
    steam.runTimers();
    await settle();
    expect(steam.fetches()).toBe(fetches);
  });
});

describe('LBK Bridge transport', () => {
  it('answers requests only after the server proved the secret', async () => {
    const secret = '34'.repeat(32);
    FakeSocket.instances = [];
    const steam = makeSteam({ v: 1, port: 50002, secret });
    steam.load('millennium').start();
    await settle();
    const ws = FakeSocket.instances[0];
    ws.onopen?.(new Event('open'));
    const cn = String(ws.sent[0].cn);
    const sn = 'ef'.repeat(16);

    ws.onmessage?.(frame({ t: 'challenge', sn, sp: 'f'.repeat(64) }));
    await settle();
    expect(ws.closed).toBe(true);

    FakeSocket.instances = [];
    const honest = makeSteam({ v: 1, port: 50002, secret });
    honest.load('millennium').start();
    await settle();
    const ok = FakeSocket.instances[0];
    ok.onopen?.(new Event('open'));
    const okCn = String(ok.sent[0].cn);
    const sp = await hmacHex(globalThis.crypto.subtle, secret, `server|${okCn}|${sn}`);
    ok.onmessage?.(frame({ t: 'challenge', sn, sp }));
    await settle();
    expect(ok.sent[1]).toEqual({
      t: 'auth',
      cp: await hmacHex(globalThis.crypto.subtle, secret, `client|${sn}|${okCn}`),
    });
    ok.onmessage?.(frame({ t: 'ready' }));
    ok.onmessage?.(frame({ t: 'req', id: 7, op: 'ping', args: {} }));
    ok.onmessage?.(frame({ t: 'req', id: 8, op: 'nope' }));
    await settle();
    expect(ok.sent.slice(2)).toEqual([
      { t: 'res', id: 7, ok: true, value: { ok: true } },
      { t: 'res', id: 8, ok: false, error: 'unknown op' },
    ]);
    expect(cn).not.toBe(okCn);
  });
});

describe('LBK Bridge spent secrets', () => {
  it('never redials a secret whose session ended, even after Steam restarts', async () => {
    const secret = 'cd'.repeat(32);
    const bridge = { v: 1, port: 50001, secret };
    const storage = makeStorage();
    FakeSocket.instances = [];

    const steam = makeSteam(bridge, storage);
    steam.load('millennium').start();
    await settle();
    const ws = FakeSocket.instances[0];
    ws.onopen?.(new Event('open'));
    const cn = String(ws.sent[0].cn);
    const sn = 'ef'.repeat(16);
    const sp = await hmacHex(globalThis.crypto.subtle, secret, `server|${cn}|${sn}`);
    ws.onmessage?.(frame({ t: 'challenge', sn, sp }));
    await settle();
    ws.onmessage?.(frame({ t: 'ready' }));
    ws.onclose?.(new CloseEvent('close'));
    await settle();

    FakeSocket.instances = [];
    const restarted = makeSteam(bridge, storage);
    restarted.load('millennium').start();
    await settle();
    expect(FakeSocket.instances).toHaveLength(0);

    FakeSocket.instances = [];
    const rotated = makeSteam({ ...bridge, secret: '12'.repeat(32) }, storage);
    rotated.load('millennium').start();
    await settle();
    expect(FakeSocket.instances).toHaveLength(1);
  });
});
