import { webcrypto } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { pathToFileURL } from 'node:url';
import vm from 'node:vm';
import {
  BRIDGE_PLUGIN_NAME,
  BRIDGE_VERSION,
  PLUGIN_ONLY_OPS,
  SHARED_STEAM_OPS,
} from '@lbk/bridge-core/contract';
import { afterEach, describe, expect, it, vi } from 'vitest';

const PACKAGES = path.resolve(__dirname, '../../../packages');
const MILLENNIUM_DIR = path.join(PACKAGES, 'lbk-bridge-millennium');
const MILLENNIUM_INDEX = path.join(MILLENNIUM_DIR, '.millennium/Dist/index.js');
const DECKY_DIR = path.join(PACKAGES, 'lbk-bridge-decky');
const DECKY_INDEX = path.join(DECKY_DIR, 'dist/index.js');
const SCRIPT_URL =
  'https://steamloopback.host/plugins/lbk-bridge/.millennium/Dist/index.js';

const readJson = (file: string): unknown => JSON.parse(fs.readFileSync(file, 'utf8'));
const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null;
const settle = () => new Promise((resolve) => setTimeout(resolve, 50));

class FakeSocket {
  static instances: FakeSocket[] = [];
  readyState = 1;
  sent: unknown[] = [];
  onopen: (() => void) | null = null;
  constructor(readonly url: string) {
    FakeSocket.instances.push(this);
  }
  send(data: string): void {
    this.sent.push(JSON.parse(data));
  }
  close(): void {
    this.readyState = 3;
  }
}

function disposeBridge(owner: Record<string, unknown>): void {
  const handle = owner.__LBK_BRIDGE__;
  if (isRecord(handle) && typeof handle.dispose === 'function') {
    handle.dispose();
  }
}

describe('Millennium bundle', () => {
  const source = fs.readFileSync(MILLENNIUM_INDEX, 'utf8');

  it('ships a manifest Millennium loads without a backend', () => {
    expect(readJson(path.join(MILLENNIUM_DIR, 'plugin.json'))).toMatchObject({
      name: BRIDGE_PLUGIN_NAME,
      version: BRIDGE_VERSION,
      useBackend: false,
    });
  });

  // ttc inlines every key of a .env next to it; an IIFE has no import.meta of its own.
  it('is a plain script with no injected environment or base URL guess', () => {
    expect(() => new vm.Script(source)).not.toThrow();
    for (const needle of [
      'process.env',
      'document.baseURI',
      'SENTRY_',
      'VITE_',
      'CSC_',
    ]) {
      expect(source).not.toContain(needle);
    }
  });

  const loadInSteam = (scripts: { src: string }[], filename: string) => {
    const fetched: string[] = [];
    const sandbox: Record<string, unknown> = {
      console,
      URL,
      TextEncoder,
      AbortController,
      crypto: webcrypto,
      WebSocket: FakeSocket,
      MILLENNIUM_BACKEND_IPC: { postMessage: () => undefined },
      document: { scripts },
      fetch: (url: string) => {
        fetched.push(url);
        const body = url.includes('/bridge.json')
          ? { v: 1, port: 50010, secret: 'ab'.repeat(32) }
          : null;
        return Promise.resolve({ ok: body !== null, json: () => Promise.resolve(body) });
      },
      setTimeout: () => 0,
      clearTimeout: () => undefined,
    };
    sandbox.window = sandbox;
    vm.runInContext(source, vm.createContext(sandbox), { filename });
    return { sandbox, fetched };
  };
  const BRIDGE_JSON_URL =
    /^https:\/\/steamloopback\.host\/plugins\/lbk-bridge\/\.millennium\/Dist\/bridge\.json\?t=\d+$/;

  it('finds bridge.json next to its own script and dials LBK', async () => {
    FakeSocket.instances = [];
    const { sandbox, fetched } = loadInSteam(
      [{ src: 'https://steamloopback.host/x.js' }, { src: SCRIPT_URL }],
      'evaluated-by-tag.js'
    );
    await settle();

    expect(fetched[0]).toMatch(BRIDGE_JSON_URL);
    expect(sandbox.__LBK_BRIDGE__).toMatchObject({
      host: 'millennium',
      version: BRIDGE_VERSION,
    });
    const ws = FakeSocket.instances[0];
    expect(ws.url).toBe('ws://127.0.0.1:50010/lbk-bridge');
    ws.onopen?.();
    expect(ws.sent[0]).toMatchObject({
      t: 'hello',
      host: 'millennium',
      pv: BRIDGE_VERSION,
    });
    expect(ws.sent[0]).toHaveProperty('ops', [...SHARED_STEAM_OPS, ...PLUGIN_ONLY_OPS]);
    disposeBridge(sandbox);
  });

  it('falls back to its own URL in the stack when no script tag names it', async () => {
    const { sandbox, fetched } = loadInSteam([], SCRIPT_URL);
    await settle();
    expect(fetched[0]).toMatch(BRIDGE_JSON_URL);
    disposeBridge(sandbox);
  });
});

describe('Decky bundle', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('has exactly the manifest fields Decky reads without defaults', () => {
    expect(readJson(path.join(DECKY_DIR, 'plugin.json'))).toEqual({
      name: 'LBK Bridge',
      author: 'LBK Team',
      flags: [],
    });
    expect(fs.existsSync(path.join(DECKY_DIR, 'main.py'))).toBe(false);
  });

  it('starts from its default export, reads ../data/bridge.json and dials LBK', async () => {
    FakeSocket.instances = [];
    const fetched: string[] = [];
    vi.stubGlobal('SP_JSX', {
      jsx: (type: unknown, props: unknown) => ({ type, props }),
    });
    vi.stubGlobal('WebSocket', FakeSocket);
    vi.stubGlobal('fetch', (url: string) => {
      fetched.push(url);
      const body = { v: 1, port: 50011, secret: 'cd'.repeat(32) };
      return Promise.resolve({ ok: true, json: () => Promise.resolve(body) });
    });
    const plugin: unknown = (await import(pathToFileURL(DECKY_INDEX).href)).default();

    expect(plugin).toMatchObject({ name: 'LBK Bridge' });
    expect(plugin).toHaveProperty('icon');
    expect(plugin).toHaveProperty('content');
    expect(Reflect.get(globalThis, '__LBK_BRIDGE__')).toMatchObject({
      host: 'decky',
      version: BRIDGE_VERSION,
    });
    expect(fetched[0]).toMatch(
      /\/packages\/lbk-bridge-decky\/data\/bridge\.json\?t=\d+$/
    );
    await settle();
    const ws = FakeSocket.instances[0];
    expect(ws.url).toBe('ws://127.0.0.1:50011/lbk-bridge');
    ws.onopen?.();
    expect(ws.sent[0]).toMatchObject({ t: 'hello', host: 'decky', pv: BRIDGE_VERSION });
    expect(ws.sent[0]).toHaveProperty('ops', [...SHARED_STEAM_OPS, ...PLUGIN_ONLY_OPS]);

    const onDismount = isRecord(plugin) ? plugin.onDismount : undefined;
    expect(onDismount).toBeTypeOf('function');
    if (typeof onDismount === 'function') {
      onDismount();
    }
    expect(Reflect.get(globalThis, '__LBK_BRIDGE__')).toBeUndefined();
    expect(ws.readyState).toBe(3);
  });
});
