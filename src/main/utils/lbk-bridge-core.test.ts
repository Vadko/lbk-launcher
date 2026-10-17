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

function makeSteam(bridgeJson: unknown = null) {
  const timers = new Map<number, () => void>();
  let nextTimer = 0;
  let fetches = 0;
  const sandbox: Record<string, unknown> = {
    console,
    URL,
    TextEncoder,
    crypto: webcrypto,
    WebSocket: FakeSocket,
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
    await flush();
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
