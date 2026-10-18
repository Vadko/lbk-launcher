import { hmacHex } from '@lbk/bridge-core/protocol';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import WebSocket from 'ws';

const pluginData = vi.hoisted(() => new Map<string, unknown>());

vi.mock('@/main/utils/plugin-data', () => ({
  writeBridgePluginData: (file: string, data: unknown) => {
    pluginData.set(file, data);
  },
  deleteBridgePluginData: (file: string) => {
    pluginData.delete(file);
  },
}));

const {
  computeServerProof,
  getConnectedPluginInfo,
  invokeViaPlugin,
  isAllowedUpgrade,
  isPluginConnected,
  onPluginConnectionChange,
  parseHello,
  startSteamBridgeServer,
  stopSteamBridgeServer,
  verifyClientProof,
} = await import('@/main/utils/steam-bridge-server');

const SECRET = 'ab'.repeat(32);
const CN = '0123456789abcdef0123456789abcdef';
const SN = 'fedcba9876543210fedcba9876543210';
const ORIGIN = 'https://steamloopback.host';

const pluginHmac = (secretHex: string, message: string) =>
  hmacHex(crypto.subtle, secretHex, message);

describe('handshake proofs', () => {
  it('server proof equals the plugin-side HMAC of "server|cn|sn"', async () => {
    expect(computeServerProof(SECRET, CN, SN)).toBe(
      await pluginHmac(SECRET, `server|${CN}|${SN}`)
    );
  });

  it('accepts the plugin-side client proof and rejects anything else', async () => {
    const cp = await pluginHmac(SECRET, `client|${SN}|${CN}`);
    expect(verifyClientProof(SECRET, SN, CN, cp)).toBe(true);
    expect(
      verifyClientProof(
        SECRET,
        SN,
        CN,
        cp.replace(/.$/, (c) => (c === '0' ? '1' : '0'))
      )
    ).toBe(false);
    expect(verifyClientProof(SECRET, CN, SN, cp)).toBe(false);
    expect(verifyClientProof(SECRET, SN, CN, cp.slice(0, 62))).toBe(false);
    expect(verifyClientProof(SECRET, SN, CN, 'zz'.repeat(32))).toBe(false);
    expect(verifyClientProof(SECRET, SN, CN, computeServerProof(SECRET, CN, SN))).toBe(
      false
    );
  });
});

describe('isAllowedUpgrade', () => {
  it('accepts only the Steam origin on the exact loopback host', () => {
    expect(isAllowedUpgrade({ origin: ORIGIN, host: '127.0.0.1:4567' }, 4567)).toBe(true);
  });

  it.each([
    ['foreign origin', { origin: 'https://example.com', host: '127.0.0.1:4567' }],
    ['missing origin', { host: '127.0.0.1:4567' }],
    ['localhost host', { origin: ORIGIN, host: 'localhost:4567' }],
    ['wrong port', { origin: ORIGIN, host: '127.0.0.1:4568' }],
    ['missing host', { origin: ORIGIN }],
    ['http origin', { origin: 'http://steamloopback.host', host: '127.0.0.1:4567' }],
  ])('rejects %s', (_label, headers) => {
    expect(isAllowedUpgrade(headers, 4567)).toBe(false);
  });
});

interface BridgeJson {
  v: number;
  port: number;
  secret: string;
}

type Message = Record<string, unknown>;

// Minimal stand-in for the plugin's transport: handshake, then hands requests to the test.
class FakePlugin {
  readonly ws: WebSocket;
  readonly requests: Message[] = [];
  private waiters: ((m: Message) => void)[] = [];
  closeCode: number | null = null;

  constructor(port: number, origin = ORIGIN) {
    this.ws = new WebSocket(`ws://127.0.0.1:${port}/lbk-bridge`, { origin });
    this.ws.on('message', (data) => {
      const msg = JSON.parse(data.toString()) as Message;
      const waiter = this.waiters.shift();
      if (waiter) {
        waiter(msg);
      } else {
        this.requests.push(msg);
      }
    });
    this.ws.on('close', (code) => {
      this.closeCode = code;
    });
  }

  next(): Promise<Message> {
    const queued = this.requests.shift();
    if (queued) {
      return Promise.resolve(queued);
    }
    return new Promise((resolve) => this.waiters.push(resolve));
  }

  send(message: Message): void {
    this.ws.send(JSON.stringify(message));
  }

  opened(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws.once('open', () => resolve());
      this.ws.once('error', reject);
    });
  }

  closed(): Promise<number> {
    if (this.closeCode !== null) {
      return Promise.resolve(this.closeCode);
    }
    return new Promise((resolve) => this.ws.once('close', (code) => resolve(code)));
  }

  async handshake(
    secret: string,
    ops: string[] = ['ping', 'libraryAppIds']
  ): Promise<void> {
    await this.opened();
    this.send({ t: 'hello', v: 1, plugin: 'lbk-bridge', pv: '1.0.0', ops, cn: CN });
    const challenge = await this.next();
    expect(challenge.t).toBe('challenge');
    const sn = challenge.sn as string;
    expect(challenge.sp).toBe(await pluginHmac(secret, `server|${CN}|${sn}`));
    this.send({ t: 'auth', cp: await pluginHmac(secret, `client|${sn}|${CN}`) });
    expect((await this.next()).t).toBe('ready');
  }
}

describe('plugin server', () => {
  let bridge: BridgeJson;
  const plugins: FakePlugin[] = [];

  function connect(origin?: string): FakePlugin {
    const plugin = new FakePlugin(bridge.port, origin);
    plugins.push(plugin);
    return plugin;
  }

  async function connected(): Promise<void> {
    for (let i = 0; i < 50 && !isPluginConnected(); i++) {
      await new Promise((r) => setTimeout(r, 10));
    }
  }

  beforeEach(async () => {
    pluginData.clear();
    await startSteamBridgeServer();
    bridge = pluginData.get('bridge.json') as BridgeJson;
  });

  afterEach(async () => {
    for (const plugin of plugins.splice(0)) {
      plugin.ws.terminate();
    }
    await stopSteamBridgeServer();
  });

  it('writes bridge.json with a loopback port and a fresh secret', () => {
    expect(bridge.v).toBe(1);
    expect(bridge.port).toBeGreaterThanOrEqual(1024);
    expect(bridge.secret).toMatch(/^[0-9a-f]{64}$/);
  });

  it('deletes bridge.json on stop', async () => {
    await stopSteamBridgeServer();
    expect(pluginData.has('bridge.json')).toBe(false);
  });

  it('refuses an upgrade from a foreign origin', async () => {
    const plugin = connect('https://example.com');
    const status = await new Promise<number>((resolve) => {
      plugin.ws.on('unexpected-response', (_req, res) => resolve(res.statusCode ?? 0));
      plugin.ws.on('error', () => undefined);
    });
    expect(status).toBe(403);
  });

  it('authenticates, runs requests and reports the connection', async () => {
    const events: boolean[] = [];
    const off = onPluginConnectionChange((c) => events.push(c));
    const plugin = connect();
    await plugin.handshake(bridge.secret);
    await connected();
    expect(isPluginConnected()).toBe(true);
    expect(getConnectedPluginInfo()).toEqual({
      pluginVersion: '1.0.0',
      ops: ['ping', 'libraryAppIds'],
      host: 'millennium',
    });

    const result = invokeViaPlugin('ping', {});
    const req = await plugin.next();
    expect(req).toMatchObject({ t: 'req', op: 'ping', args: {} });
    plugin.send({ t: 'res', id: req.id, ok: true, value: { ok: true } });
    await expect(result).resolves.toEqual({ ok: true });

    const failing = invokeViaPlugin('libraryAppIds', {});
    const req2 = await plugin.next();
    plugin.send({ t: 'res', id: req2.id, ok: false, error: 'lbk-ops: invalid args' });
    await expect(failing).rejects.toThrow('lbk-ops: invalid args');

    plugin.ws.close();
    await plugin.closed();
    for (let i = 0; i < 50 && isPluginConnected(); i++) {
      await new Promise((r) => setTimeout(r, 10));
    }
    expect(isPluginConnected()).toBe(false);
    expect(events).toEqual([true, false]);
    off();
  });

  it('rejects ops the plugin did not announce without sending them', async () => {
    const plugin = connect();
    await plugin.handshake(bridge.secret, ['ping']);
    await connected();
    await expect(
      invokeViaPlugin('setArtwork', {
        appId: 1,
        base64: '',
        ext: 'png',
        assetType: 0,
      })
    ).rejects.toThrow('plugin-outdated');
    expect(plugin.requests).toEqual([]);
  });

  it('rejects requests when no plugin is connected', async () => {
    await expect(invokeViaPlugin('ping', {})).rejects.toThrow('plugin-not-connected');
  });

  it('closes a client with a wrong proof', async () => {
    const plugin = connect();
    await plugin.opened();
    plugin.send({ t: 'hello', v: 1, plugin: 'lbk-bridge', pv: '1.0.0', ops: [], cn: CN });
    await plugin.next();
    plugin.send({ t: 'auth', cp: '00'.repeat(32) });
    expect(await plugin.closed()).toBe(4003);
    expect(isPluginConnected()).toBe(false);
  });

  it('closes a client that speaks another protocol version', async () => {
    const plugin = connect();
    await plugin.opened();
    plugin.send({ t: 'hello', v: 2, plugin: 'lbk-bridge', pv: '9.0.0', ops: [], cn: CN });
    expect(await plugin.closed()).toBe(4002);
  });

  it('sends requests one at a time, in order', async () => {
    const plugin = connect();
    await plugin.handshake(bridge.secret);
    await connected();

    const first = invokeViaPlugin('ping', {});
    const second = invokeViaPlugin('libraryAppIds', {});
    const req1 = await plugin.next();
    await new Promise((r) => setTimeout(r, 30));
    expect(plugin.requests).toEqual([]);

    plugin.send({ t: 'res', id: req1.id, ok: true, value: { ok: true } });
    const req2 = await plugin.next();
    expect(req2.op).toBe('libraryAppIds');
    plugin.send({ t: 'res', id: req2.id, ok: true, value: [10, 20] });

    await expect(first).resolves.toEqual({ ok: true });
    await expect(second).resolves.toEqual([10, 20]);
  });

  it('times out a request but holds the queue until the stale answer arrives', async () => {
    const plugin = connect();
    await plugin.handshake(bridge.secret);
    await connected();

    const slow = invokeViaPlugin('ping', {}, 30);
    const req1 = await plugin.next();
    await expect(slow).rejects.toThrow(/timed out/);

    const next = invokeViaPlugin('libraryAppIds', {});
    await new Promise((r) => setTimeout(r, 30));
    expect(plugin.requests).toEqual([]);

    plugin.send({ t: 'res', id: req1.id, ok: true, value: { ok: true } });
    const req2 = await plugin.next();
    plugin.send({ t: 'res', id: req2.id, ok: true, value: [] });
    await expect(next).resolves.toEqual([]);
  });

  it('writes a fresh secret once a session ends, so the old one stops working', async () => {
    const first = connect();
    await first.handshake(bridge.secret);
    await connected();
    const spent = bridge.secret;

    first.ws.close();
    await first.closed();
    for (let i = 0; i < 50 && isPluginConnected(); i++) {
      await new Promise((r) => setTimeout(r, 10));
    }
    const rotated = pluginData.get('bridge.json') as BridgeJson;
    expect(rotated.port).toBe(bridge.port);
    expect(rotated.secret).toMatch(/^[0-9a-f]{64}$/);
    expect(rotated.secret).not.toBe(spent);

    const second = connect();
    await second.opened();
    second.send({ t: 'hello', v: 1, plugin: 'lbk-bridge', pv: '1.0.0', ops: [], cn: CN });
    const challenge = await second.next();
    const sn = challenge.sn as string;
    expect(challenge.sp).not.toBe(await pluginHmac(spent, `server|${CN}|${sn}`));
    second.send({ t: 'auth', cp: await pluginHmac(spent, `client|${sn}|${CN}`) });
    expect(await second.closed()).toBe(4003);
  });

  it('keeps a connected client that still answers and refuses the newcomer', async () => {
    const first = connect();
    await first.handshake(bridge.secret);
    await connected();
    first.ws.on('message', (data) => {
      const msg = JSON.parse(data.toString()) as Message;
      if (msg.t === 'ping') {
        first.send({ t: 'pong', id: msg.id });
      }
    });

    const second = connect();
    await second.opened();
    second.send({ t: 'hello', v: 1, plugin: 'lbk-bridge', pv: '1.0.0', ops: [], cn: CN });
    const challenge = await second.next();
    const sn = challenge.sn as string;
    second.send({ t: 'auth', cp: await pluginHmac(bridge.secret, `client|${sn}|${CN}`) });

    expect(await second.closed()).toBe(4011);
    expect(first.closeCode).toBeNull();
    expect(isPluginConnected()).toBe(true);
  });

  it('replaces the old client once it stops answering', async () => {
    const first = connect();
    await first.handshake(bridge.secret);
    await connected();
    const pending = expect(invokeViaPlugin('ping', {})).rejects.toThrow(
      'plugin-disconnected'
    );
    await first.next();

    const second = connect();
    await second.handshake(bridge.secret);
    expect(await first.closed()).toBe(4009);
    await pending;
    expect(isPluginConnected()).toBe(true);

    const result = invokeViaPlugin('ping', {});
    const req = await second.next();
    second.send({ t: 'res', id: req.id, ok: true, value: { ok: true } });
    await expect(result).resolves.toEqual({ ok: true });
  });
});

describe('parseHello', () => {
  const hello = (extra: Record<string, unknown> = {}) => ({
    t: 'hello',
    v: 1,
    plugin: 'lbk-bridge',
    pv: '1.1.0',
    ops: ['ping'],
    cn: CN,
    ...extra,
  });

  it('defaults a missing host to millennium for 1.0.0 plugins', () => {
    expect(parseHello(hello())?.host).toBe('millennium');
  });

  it('accepts the Decky host', () => {
    expect(parseHello(hello({ host: 'decky' }))?.host).toBe('decky');
  });

  it('rejects an unknown host', () => {
    expect(parseHello(hello({ host: 'browser' }))).toBeNull();
    expect(parseHello(hello({ host: 1 }))).toBeNull();
  });
});
