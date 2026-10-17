import { webcrypto } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import vm from 'node:vm';
import { describe, expect, it } from 'vitest';
import { MILLENNIUM_PLUGIN_VERSION } from '@/main/utils/steam-bridge-ops';

const PLUGIN_INDEX = path.resolve(
  __dirname,
  '../../../resources/millennium-plugin/lbk-bridge/frontend/index.js'
);
const CORE_BEGIN = '/* @lbk-core:begin */\n';
const CORE_END = '\n/* @lbk-core:end */';

const source = fs.readFileSync(PLUGIN_INDEX, 'utf8');
const core = source.slice(
  source.indexOf(CORE_BEGIN) + CORE_BEGIN.length,
  source.indexOf(CORE_END)
);

type Host = 'millennium' | 'decky';

interface BridgeState {
  host: Host;
  version: string;
  status: string;
  idle: boolean;
}

interface LoadedCopy {
  start: () => void;
  dispose: () => void;
  state: BridgeState;
}

class FakeSocket {
  static OPEN = 1;
  static instances: FakeSocket[] = [];
  readyState = 1;
  sent: unknown[] = [];
  closed = false;
  onopen: (() => void) | null = null;
  onclose: (() => void) | null = null;
  onmessage: ((ev: { data: string }) => Promise<void>) | null = null;
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

function makeStorage() {
  const items = new Map<string, string>();
  return {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => void items.set(key, value),
  };
}

function makeSteam(
  bridgeJson: unknown = null,
  localStorage?: ReturnType<typeof makeStorage>
) {
  const timers = new Map<number, () => void>();
  let nextTimer = 0;
  let fetches = 0;
  const sandbox: Record<string, unknown> = {
    console,
    URL,
    TextEncoder,
    crypto: webcrypto,
    WebSocket: FakeSocket,
    localStorage,
    fetch: () => {
      fetches++;
      return Promise.resolve({
        ok: bridgeJson !== null,
        json: () => Promise.resolve(bridgeJson),
      });
    },
    setTimeout: (fn: () => void) => {
      nextTimer++;
      timers.set(nextTimer, fn);
      return nextTimer;
    },
    clearTimeout: (id: number) => {
      timers.delete(id);
    },
  };
  sandbox.window = sandbox;
  const ctx = vm.createContext(sandbox);
  return {
    sandbox,
    timers,
    fetches: () => fetches,
    load(host: Host): LoadedCopy {
      return vm.runInContext(
        `(() => {
          const HOST = ${JSON.stringify(host)};
          const DATA_BASE = new URL('http://127.0.0.1:1337/plugins/LBK%20Bridge/data/');
          ${core}
          return { start, dispose, state };
        })()`,
        ctx
      ) as LoadedCopy;
    },
    runTimers() {
      const pending = [...timers.values()];
      timers.clear();
      for (const fn of pending) {
        fn();
      }
    },
  };
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
// connect() awaits WebCrypto before it dials.
const settle = () => new Promise((resolve) => setTimeout(resolve, 20));

describe('LBK Bridge core double-load guard', () => {
  it('replaces its own earlier copy on a reload', () => {
    const steam = makeSteam();
    const first = steam.load('millennium');
    first.start();
    expect(steam.sandbox.__LBK_BRIDGE__).toBe(first.state);

    const second = steam.load('millennium');
    second.start();
    expect(first.state.status).toBe('disposed');
    expect(second.state.idle).toBe(false);
    expect(steam.sandbox.__LBK_BRIDGE__).toBe(second.state);
  });

  it('keeps the Decky copy idle while Millennium runs the bridge', () => {
    const steam = makeSteam();
    const millennium = steam.load('millennium');
    millennium.start();
    const decky = steam.load('decky');
    decky.start();
    expect(decky.state.idle).toBe(true);
    expect(millennium.state.status).not.toBe('disposed');
    expect(steam.sandbox.__LBK_BRIDGE__).toBe(millennium.state);

    decky.dispose();
    expect(steam.sandbox.__LBK_BRIDGE__).toBe(millennium.state);
  });

  it('lets Millennium take over from a running Decky copy', () => {
    const steam = makeSteam();
    const decky = steam.load('decky');
    decky.start();
    const millennium = steam.load('millennium');
    millennium.start();
    expect(decky.state.status).toBe('disposed');
    expect(steam.sandbox.__LBK_BRIDGE__).toBe(millennium.state);
    expect(millennium.state.host).toBe('millennium');
  });

  it('yields to a 1.0.0 copy that cannot be stopped', () => {
    const steam = makeSteam();
    const legacy = { version: '1.0.0', status: 'connected' };
    steam.sandbox.__LBK_BRIDGE__ = legacy;
    for (const host of ['millennium', 'decky'] as const) {
      const copy = steam.load(host);
      copy.start();
      expect(copy.state.idle).toBe(true);
      expect(steam.sandbox.__LBK_BRIDGE__).toBe(legacy);
    }
  });

  it('stops reconnecting once disposed', async () => {
    const steam = makeSteam();
    const copy = steam.load('decky');
    copy.start();
    await flush();
    const fetches = steam.fetches();
    expect(fetches).toBeGreaterThan(0);

    copy.dispose();
    expect(steam.sandbox.__LBK_BRIDGE__).toBeUndefined();
    steam.runTimers();
    await flush();
    expect(steam.fetches()).toBe(fetches);
  });
});

describe('LBK Bridge core transport', () => {
  it('announces its host and version, and closes the socket on dispose', async () => {
    FakeSocket.instances = [];
    const steam = makeSteam({ v: 1, port: 50000, secret: 'ab'.repeat(32) });
    const copy = steam.load('decky');
    copy.start();
    await settle();
    const ws = FakeSocket.instances[0];
    expect(ws.url).toBe('ws://127.0.0.1:50000/lbk-bridge');

    ws.onopen?.();
    expect(ws.sent[0]).toMatchObject({
      t: 'hello',
      plugin: 'lbk-bridge',
      host: 'decky',
      pv: MILLENNIUM_PLUGIN_VERSION,
    });
    expect((ws.sent[0] as { ops: string[] }).ops).toContain('deckyRequestInstall');

    copy.dispose();
    expect(ws.closed).toBe(true);
  });
});

async function hmacHex(secret: string, msg: string): Promise<string> {
  const key = await webcrypto.subtle.importKey(
    'raw',
    Buffer.from(secret, 'hex'),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  return Buffer.from(await webcrypto.subtle.sign('HMAC', key, Buffer.from(msg))).toString(
    'hex'
  );
}

describe('LBK Bridge core spent secrets', () => {
  it('never redials a secret whose session ended, even after Steam restarts', async () => {
    const secret = 'cd'.repeat(32);
    const bridge = { v: 1, port: 50001, secret };
    const storage = makeStorage();
    FakeSocket.instances = [];

    const steam = makeSteam(bridge, storage);
    steam.load('millennium').start();
    await settle();
    const ws = FakeSocket.instances[0];
    ws.onopen?.();
    const { cn } = ws.sent[0] as { cn: string };
    const sn = 'ef'.repeat(16);
    await ws.onmessage?.({
      data: JSON.stringify({
        t: 'challenge',
        sn,
        sp: await hmacHex(secret, `server|${cn}|${sn}`),
      }),
    });
    await ws.onmessage?.({ data: JSON.stringify({ t: 'ready' }) });
    ws.onclose?.();
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
