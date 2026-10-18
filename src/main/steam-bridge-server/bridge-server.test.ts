import { once } from 'node:events';
import { connect as connectTcp, type Socket } from 'node:net';
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

const { appEvents } = await import('@/main/app-events');
const {
  getConnectedPluginInfo,
  invokeViaPlugin,
  isPluginConnected,
  startSteamBridgeServer,
  stopSteamBridgeServer,
} = await import('@/main/steam-bridge-server/bridge-server');

const CN = '0123456789abcdef0123456789abcdef';
const helloFrame = (extra: Record<string, unknown> = {}) => ({
  t: 'hello',
  v: 1,
  plugin: 'lbk-bridge',
  pv: '1.1.0',
  host: 'millennium',
  ops: [],
  cn: CN,
  ...extra,
});
const ORIGIN = 'https://steamloopback.host';

const pluginHmac = (secretHex: string, message: string) =>
  hmacHex(crypto.subtle, secretHex, message);

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

  constructor(port: number) {
    this.ws = new WebSocket(`ws://127.0.0.1:${port}/lbk-bridge`, { origin: ORIGIN });
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
    this.send(helloFrame({ ops }));
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
  const sockets: Socket[] = [];

  function connect(): FakePlugin {
    const plugin = new FakePlugin(bridge.port);
    plugins.push(plugin);
    return plugin;
  }

  const connected = (state = true) =>
    vi.waitFor(() => expect(isPluginConnected()).toBe(state));

  beforeEach(async () => {
    pluginData.clear();
    await startSteamBridgeServer();
    bridge = pluginData.get('bridge.json') as BridgeJson;
  });

  afterEach(async () => {
    for (const plugin of plugins.splice(0)) {
      plugin.ws.terminate();
    }
    for (const socket of sockets.splice(0)) {
      socket.destroy();
    }
    await stopSteamBridgeServer();
  });

  it('writes bridge.json with a loopback port and a fresh secret, and deletes it on stop', async () => {
    expect(bridge.v).toBe(1);
    expect(bridge.port).toBeGreaterThanOrEqual(1024);
    expect(bridge.secret).toMatch(/^[0-9a-f]{64}$/);
    await stopSteamBridgeServer();
    expect(pluginData.has('bridge.json')).toBe(false);
  });

  it('drops a refused client that keeps its side open, so stop does not hang', async () => {
    const socket = connectTcp({
      host: '127.0.0.1',
      port: bridge.port,
      allowHalfOpen: true,
    });
    sockets.push(socket);
    socket.on('error', () => undefined);
    await once(socket, 'connect');
    socket.write(
      [
        'GET /lbk-bridge HTTP/1.1',
        `Host: 127.0.0.1:${bridge.port}`,
        'Upgrade: websocket',
        'Connection: Upgrade',
        'Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==',
        'Sec-WebSocket-Version: 13',
        'Origin: https://example.com',
        '',
        '',
      ].join('\r\n')
    );
    const [response] = await once(socket, 'data');
    expect(String(response)).toMatch(/^HTTP\/1\.1 403 /);

    const stopped = await Promise.race([
      stopSteamBridgeServer().then(() => 'stopped'),
      new Promise((r) => setTimeout(() => r('hung'), 2000)),
    ]);
    expect(stopped).toBe('stopped');
  });

  it('authenticates, runs requests and reports the connection', async () => {
    const events: boolean[] = [];
    const onConnection = (c: boolean) => events.push(c);
    appEvents.on('plugin-connection', onConnection);
    const plugin = connect();
    await plugin.handshake(bridge.secret);
    await connected();
    expect(getConnectedPluginInfo()).toEqual({
      pluginVersion: '1.1.0',
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
    await connected(false);
    expect(events).toEqual([true, false]);
    appEvents.off('plugin-connection', onConnection);
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
    await expect(invokeViaPlugin('ping', {})).rejects.toMatchObject({
      code: 'not-connected',
    });
  });

  it('closes a client with a wrong proof', async () => {
    const plugin = connect();
    await plugin.opened();
    plugin.send(helloFrame());
    await plugin.next();
    plugin.send({ t: 'auth', cp: '00'.repeat(32) });
    expect(await plugin.closed()).toBe(4003);
    expect(isPluginConnected()).toBe(false);
  });

  it('closes a client that speaks another protocol version', async () => {
    const plugin = connect();
    await plugin.opened();
    plugin.send(helloFrame({ v: 2, pv: '9.0.0' }));
    expect(await plugin.closed()).toBe(4002);
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
    await connected(false);
    const rotated = pluginData.get('bridge.json') as BridgeJson;
    expect(rotated.port).toBe(bridge.port);
    expect(rotated.secret).toMatch(/^[0-9a-f]{64}$/);
    expect(rotated.secret).not.toBe(spent);

    const second = connect();
    await second.opened();
    second.send(helloFrame());
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
    second.send(helloFrame());
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

describe('shutdown', () => {
  it('stays down when a disconnect listener starts the server again', async () => {
    vi.resetModules();
    const { appEvents: events } = await import('@/main/app-events');
    const bridgeServer = await import('@/main/steam-bridge-server/bridge-server');
    pluginData.clear();
    await bridgeServer.startSteamBridgeServer();
    const { port, secret } = pluginData.get('bridge.json') as BridgeJson;
    const plugin = new FakePlugin(port);
    await plugin.handshake(secret);
    await vi.waitFor(() => expect(bridgeServer.isPluginConnected()).toBe(true));
    const restarts: Promise<void>[] = [];
    events.on('plugin-connection', (connected) => {
      if (!connected) {
        restarts.push(bridgeServer.startSteamBridgeServer());
      }
    });

    await bridgeServer.shutdownSteamBridgeServer();
    await Promise.all(restarts);
    await bridgeServer.startSteamBridgeServer();

    expect(restarts).toHaveLength(1);
    expect(await plugin.closed()).toBe(4010);
    expect(pluginData.has('bridge.json')).toBe(false);
  });
});
