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
import { hmacHex } from '@lbk/bridge-core/protocol';
import * as React from 'react';
import * as jsxRuntime from 'react/jsx-runtime';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const PACKAGES = path.resolve(__dirname, '../../../packages');
const MILLENNIUM_DIR = path.join(PACKAGES, 'lbk-bridge-millennium');
const MILLENNIUM_INDEX = path.join(MILLENNIUM_DIR, '.millennium/Dist/index.js');
const MILLENNIUM_WEBKIT = path.join(MILLENNIUM_DIR, '.millennium/Dist/webkit.js');
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
  sent: Record<string, unknown>[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((ev: { data: string }) => void) | null = null;
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

// Steam's CSP may forbid eval; zod/mini never compiles validators, and the full zod would.
it.each([
  ['Millennium', MILLENNIUM_INDEX],
  ['Millennium webkit', MILLENNIUM_WEBKIT],
  ['Decky', DECKY_INDEX],
])('the %s bundle compiles no code at runtime', (_host, file) => {
  expect(fs.readFileSync(file, 'utf8')).not.toMatch(/\bFunction\b|\beval\(/);
});

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
      AbortSignal,
      EventTarget,
      Event,
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

  it.each([
    'https://steamloopback.host/plugins/lbk-bridge',
    'https://x/C:/Program%20Files%20(x86)/Steam/plugins/lbk-bridge',
  ])('falls back to its own URL in the stack under %s', async (pluginDir) => {
    const { sandbox, fetched } = loadInSteam(
      [],
      `${pluginDir}/.millennium/Dist/index.js`
    );
    await settle();
    expect(fetched[0]?.split('?')[0]).toBe(`${pluginDir}/.millennium/Dist/bridge.json`);
    disposeBridge(sandbox);
  });
});

describe('Millennium webkit bundle', () => {
  const source = fs.readFileSync(MILLENNIUM_WEBKIT, 'utf8');
  const PLUGIN_DIR = 'https://millennium.ftp/C:/Program%20Files%20(x86)/Steam/plugins';
  const OWN_SCRIPT = `${PLUGIN_DIR}/lbk-bridge/.millennium/Dist/webkit.js`;
  const PAGE = Symbol.for('lbk.achievementPage');

  // Millennium appends one millennium-injected tag per plugin to every Steam web page.
  const loadInPage = (href: string) => {
    const fetched: { url: string; init: unknown }[] = [];
    let scriptReads = 0;
    const scripts = [
      { src: `${PLUGIN_DIR}/other/.millennium/Dist/webkit.js` },
      { src: OWN_SCRIPT },
    ];
    const sandbox: Record<string, unknown> = {
      console,
      URL,
      AbortController,
      AbortSignal,
      location: { href },
      document: {
        get scripts() {
          scriptReads += 1;
          return scripts;
        },
      },
      fetch: (url: string, init: unknown) => {
        fetched.push({ url, init });
        const body = { v: 1, stamp: 's', apps: { 620: { A: { name: 'Так' } } } };
        return Promise.resolve({ ok: true, json: () => Promise.resolve(body) });
      },
      setTimeout: () => 0,
      clearTimeout: () => undefined,
    };
    sandbox.window = sandbox;
    vm.runInContext(source, vm.createContext(sandbox), { filename: 'webkit.js' });
    return { sandbox, fetched, scriptReads: () => scriptReads };
  };

  // Web pages get public achievement strings and nothing that reaches LBK.
  it.each([
    ['WebSocket', /WebSocket/],
    ['bridge.json', /bridge\.json/],
    ['localStorage', /localStorage/],
    ['zod', /_zod|\bzod\b/],
  ])('is a plain script with no %s', (_label, pattern) => {
    expect(() => new vm.Script(source)).not.toThrow();
    expect(source).not.toMatch(pattern);
  });

  it('leaves any other page before it looks for anything', async () => {
    const page = loadInPage('https://store.steampowered.com/search/?term=portal');
    await settle();
    expect(page.fetched).toEqual([]);
    expect(page.scriptReads()).toBe(0);
    expect(Reflect.get(page.sandbox, PAGE)).toBeUndefined();
  });

  it.each([
    'https://steamcommunity.com/achievements/620',
    'https://steamcommunity.com/profiles/76561197960287930/achievements/620/',
    'https://store.steampowered.com/app/620/Portal_2/',
  ])('reads achievements.json next to its own script once on %s', async (href) => {
    const page = loadInPage(href);
    await settle();
    expect(page.fetched).toEqual([
      {
        url: expect.stringMatching(
          /^https:\/\/millennium\.ftp\/C:\/Program%20Files%20\(x86\)\/Steam\/plugins\/lbk-bridge\/\.millennium\/Dist\/achievements\.json\?t=\d+$/
        ),
        init: { cache: 'no-store' },
      },
    ]);
    const handle: unknown = Reflect.get(page.sandbox, PAGE);
    expect(handle).toMatchObject({ version: 1 });
    if (isRecord(handle) && typeof handle.wanted === 'function') {
      expect(handle.wanted()).toEqual([]);
    }
    if (isRecord(handle) && typeof handle.dispose === 'function') {
      handle.dispose();
    }
  });
});

interface ExternalStore {
  subscribe: (onChange: () => void) => () => void;
  getSnapshot: () => string;
}

describe('Decky bundle', () => {
  let store: ExternalStore | undefined;
  beforeEach(() => {
    store = undefined;
    vi.stubGlobal('SP_REACT', {
      ...React,
      // Steam renders on the client; renderToStaticMarkup also needs a server snapshot.
      useSyncExternalStore: (
        subscribe: ExternalStore['subscribe'],
        getSnapshot: ExternalStore['getSnapshot']
      ) => {
        store = { subscribe, getSnapshot };
        return React.useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
      },
    });
    vi.stubGlobal('SP_JSX', jsxRuntime);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const render = (node: unknown) =>
    React.isValidElement(node) ? renderToStaticMarkup(node) : null;
  const loadPlugin = async (query = '') => {
    const plugin: unknown = (await import(`${pathToFileURL(DECKY_INDEX).href}${query}`))
      .default;
    return typeof plugin === 'function' ? plugin() : null;
  };
  const dismount = (plugin: unknown) => {
    const onDismount = isRecord(plugin) ? plugin.onDismount : undefined;
    expect(onDismount).toBeTypeOf('function');
    if (typeof onDismount === 'function') {
      onDismount();
    }
  };

  it('has exactly the manifest fields Decky reads without defaults', () => {
    expect(readJson(path.join(DECKY_DIR, 'plugin.json'))).toEqual({
      name: 'LBK Bridge',
      author: 'LBK Team',
      flags: [],
    });
    expect(fs.existsSync(path.join(DECKY_DIR, 'main.py'))).toBe(false);
  });

  it('takes React from Decky instead of bundling a copy', () => {
    expect(fs.readFileSync(DECKY_INDEX, 'utf8')).not.toMatch(
      /^import\b|['"]react(-dom)?(\/[\w-]+)?['"]|react\.(transitional\.)?element/m
    );
  });

  it('starts from its default export, reads ../data/bridge.json and dials LBK', async () => {
    FakeSocket.instances = [];
    const fetched: string[] = [];
    const secret = 'cd'.repeat(32);
    vi.stubGlobal('WebSocket', FakeSocket);
    vi.stubGlobal('fetch', (url: string) => {
      fetched.push(url);
      const body = { v: 1, port: 50011, secret };
      return Promise.resolve({ ok: true, json: () => Promise.resolve(body) });
    });
    const plugin = await loadPlugin();

    expect(plugin).toMatchObject({ name: 'LBK Bridge' });
    const { icon, content } = isRecord(plugin) ? plugin : {};
    expect(render(icon)).toMatch(/^<svg [^>]*width="1em" height="1em"/);
    expect(render(content)).toContain('>Очікування LBK Launcher</div>');
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

    const onChange = vi.fn();
    const unsubscribe = store?.subscribe(onChange);
    const cn = String(ws.sent[0].cn);
    const sn = 'ef'.repeat(16);
    const sp = await hmacHex(globalThis.crypto.subtle, secret, `server|${cn}|${sn}`);
    ws.onmessage?.({ data: JSON.stringify({ t: 'challenge', sn, sp }) });
    await settle();
    ws.onmessage?.({ data: JSON.stringify({ t: 'ready' }) });
    expect(onChange).toHaveBeenCalled();
    expect(store?.getSnapshot()).toBe('Підключено до LBK Launcher');

    unsubscribe?.();
    const calls = onChange.mock.calls.length;
    dismount(plugin);
    expect(onChange).toHaveBeenCalledTimes(calls);
    expect(Reflect.get(globalThis, '__LBK_BRIDGE__')).toBeUndefined();
    expect(ws.readyState).toBe(3);
  });

  it('stays idle next to a running Millennium copy and leaves it alone', async () => {
    const millennium = { host: 'millennium', dispose: vi.fn() };
    vi.stubGlobal('__LBK_BRIDGE__', millennium);
    const plugin = await loadPlugin('?idle');

    const { content } = isRecord(plugin) ? plugin : {};
    expect(render(content)).toContain('>Працює через Millennium</div>');
    dismount(plugin);
    expect(millennium.dispose).not.toHaveBeenCalled();
    expect(Reflect.get(globalThis, '__LBK_BRIDGE__')).toBe(millennium);
  });
});
