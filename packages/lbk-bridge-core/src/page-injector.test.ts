import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AppStrings } from './achievement-text';
import { createPageInjector, type PageInjector } from './page-injector';
import type { BridgeSocket } from './socket';

const BROWSER = 'ws://127.0.0.1:8080/devtools/browser/0a1b-2c3d';
const SCRIPT = '/* the page module */';
const PORTAL2: AppStrings = { 'ACH.SURVIVE_CONTAINER_RIDE': { name: 'Підйом' } };
const COMMUNITY = 'https://steamcommunity.com/achievements/620';

interface Sent {
  id: number;
  method: string;
  params: Record<string, unknown>;
  sessionId?: string;
}

class FakeCdp implements BridgeSocket {
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
  // Answers every command of this kind still waiting for a reply.
  reply(method: string, result: object = {}, sessionId?: string): void {
    for (const { id } of this.find(method, sessionId)) {
      this.onmessage?.(
        new MessageEvent('message', { data: JSON.stringify({ id, result }) })
      );
    }
  }
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

const running: PageInjector[] = [];
afterEach(() => {
  for (const injector of running.splice(0)) {
    injector.dispose();
  }
  vi.restoreAllMocks();
});

function setUp(version: unknown = { webSocketDebuggerUrl: BROWSER }) {
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
  running.push(injector);
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

describe('page injector: finding Steam CEF', () => {
  it('reads /json/version on 8080 and dials the browser endpoint there, whatever host it names', async () => {
    const steam = setUp({
      webSocketDebuggerUrl: 'ws://localhost:9222/devtools/browser/0a1b-2c3d',
    });
    await steam.connect();
    expect(steam.fetchJson).toHaveBeenCalledWith('http://127.0.0.1:8080/json/version');
    expect(steam.cdp().url).toBe(BROWSER);
    expect(steam.cdp().sent).toEqual([
      { id: 1, method: 'Target.setDiscoverTargets', params: { discover: true } },
    ]);
  });

  it.each([
    ['no answer', null],
    ['no browser endpoint', { Browser: 'Chrome/126' }],
    ['a page endpoint', { webSocketDebuggerUrl: 'ws://127.0.0.1:8080/devtools/page/AB' }],
    ['not a URL', { webSocketDebuggerUrl: 'devtools' }],
  ])('dials nothing on %s and tries again in 2 s', async (_label, version) => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const steam = setUp(version);
    steam.injector.start();
    await settle();
    expect(steam.sockets).toEqual([]);
    expect(steam.retries()).toEqual([2000]);
  });

  it('backs off to 2 minutes and warns once per kind of failure', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const steam = setUp();
    steam.fetchJson.mockRejectedValue(new Error('502'));
    steam.injector.start();
    const delays: (number | undefined)[] = [];
    for (let i = 0; i < 8; i++) {
      await settle();
      delays.push(...steam.retries());
      await steam.runRetry();
    }
    expect(delays).toEqual([2000, 4000, 8000, 16000, 32000, 64000, 120000, 120000]);
    expect(warn).toHaveBeenCalledOnce();
  });

  it('reconnects 2 s after Steam closes the socket', async () => {
    const steam = setUp();
    const first = await steam.connect();
    first.drop();
    await settle();
    expect(steam.retries()).toEqual([2000]);
    await steam.runRetry();
    expect(steam.fetchJson).toHaveBeenCalledTimes(2);
    expect(steam.sockets).toHaveLength(2);
  });

  it('closes the socket on dispose and stays down', async () => {
    const steam = setUp();
    const ws = await steam.connect();
    steam.injector.dispose();
    await settle();
    expect(ws.readyState).toBe(3);
    expect(steam.retries()).toEqual([]);
    steam.injector.start();
    await settle();
    expect(steam.sockets).toHaveLength(1);
  });
});

describe('page injector: targets', () => {
  it.each([
    ['a community page', true, 'page', COMMUNITY],
    ['a store page', true, 'page', 'https://store.steampowered.com/app/620/Portal_2/'],
    ['another site in the overlay browser', false, 'page', 'https://example.com/'],
    [
      'a Valve site without achievements',
      false,
      'page',
      'https://help.steampowered.com/',
    ],
    ['checkout', false, 'page', 'https://checkout.steampowered.com/checkout/'],
    ['Steam UI', false, 'page', 'https://steamloopback.host/routes/library/home'],
    ['an about:blank popup', false, 'page', 'about:blank?createflags=274'],
    ['an out-of-process iframe', false, 'iframe', COMMUNITY],
    ['a service worker', false, 'service_worker', 'https://store.steampowered.com/sw.js'],
  ])('on %s attaches: %s', async (_label, attaches, type, url) => {
    const steam = setUp();
    const ws = await steam.connect();
    ws.emit('Target.targetCreated', { targetInfo: { targetId: 'T1', type, url } });
    expect(ws.find('Target.attachToTarget').map((c) => c.params)).toEqual(
      attaches ? [{ targetId: 'T1', flatten: true }] : []
    );
  });

  it('registers the binding and the page module for new documents, then runs it in the open one', async () => {
    const steam = setUp();
    const ws = await steam.connect();
    const sessionId = await steam.attach('T1');

    expect(ws.methods(sessionId)).toEqual([
      'Runtime.enable',
      'Runtime.addBinding',
      'Page.enable',
      'Page.addScriptToEvaluateOnNewDocument',
      'Runtime.evaluate',
    ]);
    const [binding] = ws.find('Runtime.addBinding', sessionId);
    const [script] = ws.find('Page.addScriptToEvaluateOnNewDocument', sessionId);
    const [evaluate] = ws.find('Runtime.evaluate', sessionId);
    const source = String(script.params.source);
    expect(source.startsWith(`${SCRIPT}\n`)).toBe(true);
    expect(source).toContain(`globalThis.${String(binding.params.name)}`);
    expect(evaluate.params).toEqual({ expression: source });
  });

  it.each([
    ['Steam UI', 'https://steamloopback.host/routes/library/home', true],
    ['another site', 'https://example.com/', true],
    ['about:blank', 'about:blank', false],
    ['the store', 'https://store.steampowered.com/app/620/Portal_2/', false],
  ])('when a page moves to %s detaches: %s', async (_label, url, detaches) => {
    const steam = setUp();
    const ws = await steam.connect();
    const sessionId = await steam.attach('T1');
    ws.emit('Target.targetInfoChanged', {
      targetInfo: { targetId: 'T1', type: 'page', url },
    });
    expect(ws.find('Target.detachFromTarget').map((c) => c.params)).toEqual(
      detaches ? [{ sessionId }] : []
    );
  });

  it('attaches again to a target that came back after it was destroyed', async () => {
    const steam = setUp();
    const ws = await steam.connect();
    ws.emit('Target.targetCreated', {
      targetInfo: { targetId: 'T2', type: 'page', url: COMMUNITY },
    });
    ws.emit('Target.targetDestroyed', { targetId: 'T2' });
    ws.emit('Target.targetCreated', {
      targetInfo: { targetId: 'T2', type: 'page', url: COMMUNITY },
    });
    expect(
      ws.find('Target.attachToTarget').filter((c) => c.params.targetId === 'T2')
    ).toHaveLength(2);
  });
});

describe('page injector: asks from pages', () => {
  async function onAchievementsPage() {
    const steam = setUp();
    const ws = await steam.connect();
    const sessionId = await steam.attach('T1');
    const context = (id: number, origin: string, uniqueId: string | null = `u${id}`) =>
      ws.emit(
        'Runtime.executionContextCreated',
        { context: uniqueId === null ? { id, origin } : { id, origin, uniqueId } },
        sessionId
      );
    context(7, 'https://steamcommunity.com');
    context(8, 'https://example.com');
    context(10, 'https://steamcommunity.com', null);
    const [binding] = ws.find('Runtime.addBinding', sessionId);
    const ask = async (overrides: Record<string, unknown> = {}) => {
      ws.emit(
        'Runtime.bindingCalled',
        {
          name: binding.params.name,
          payload: '620',
          executionContextId: 7,
          ...overrides,
        },
        sessionId
      );
      await settle();
    };
    const answers = () =>
      ws.find('Runtime.callFunctionOn', sessionId).map((c) => c.params);
    return { ...steam, ws, sessionId, context, ask, answers };
  }

  it("answers with that app's strings as CDP values, in the context that asked", async () => {
    const page = await onAchievementsPage();
    await page.ask();
    await page.ask({ payload: '400' });

    expect(page.strings.mock.calls).toEqual([['620'], ['400']]);
    expect(page.answers()).toEqual([
      {
        functionDeclaration: expect.stringContaining('.provide(appid, strings)'),
        uniqueContextId: 'u7',
        arguments: [{ value: '620' }, { value: PORTAL2 }],
        returnByValue: true,
      },
      expect.objectContaining({ arguments: [{ value: '400' }, { value: null }] }),
    ]);
  });

  it.each([
    ['a leading zero', { payload: '0620' }],
    ['script text', { payload: '620);alert(1' }],
    ['a number', { payload: 620 }],
    ['eleven digits', { payload: '12345678901' }],
    ['another binding', { name: 'devtoolsBinding' }],
    ['a context that never appeared', { executionContextId: 99 }],
    ['another site', { executionContextId: 8 }],
    ['a context Chrome gave no unique id', { executionContextId: 10 }],
  ])('ignores an ask with %s', async (_label, overrides) => {
    const page = await onAchievementsPage();
    await page.ask(overrides);
    expect(page.strings).not.toHaveBeenCalled();
    expect(page.answers()).toEqual([]);
  });

  it('answers an app once per document and forgets documents that are gone', async () => {
    const page = await onAchievementsPage();
    await page.ask();
    await page.ask();
    expect(page.answers()).toHaveLength(1);

    page.ws.emit('Runtime.executionContextsCleared', {}, page.sessionId);
    await page.ask();
    expect(page.answers()).toHaveLength(1);
    page.context(9, 'https://steamcommunity.com');
    await page.ask({ executionContextId: 9 });
    page.ws.emit(
      'Runtime.executionContextDestroyed',
      { executionContextId: 9 },
      page.sessionId
    );
    await page.ask({ executionContextId: 9 });
    expect(page.answers().map((a) => a.uniqueContextId)).toEqual(['u7', 'u9']);
  });

  it.each([
    ['the document was replaced', 'Runtime.executionContextsCleared', true],
    ['the target was detached', 'Target.detachedFromTarget', false],
  ])(
    'drops a late answer when %s, even with the context id reused',
    async (_label, event, inSession) => {
      const page = await onAchievementsPage();
      let release: (strings: AppStrings) => void = () => undefined;
      page.strings.mockReturnValueOnce(
        new Promise((resolve) => {
          release = resolve;
        })
      );
      await page.ask();
      page.ws.emit(
        event,
        { sessionId: page.sessionId },
        inSession ? page.sessionId : undefined
      );
      page.context(7, 'https://steamcommunity.com', 'u7-next');
      release(PORTAL2);
      await settle();
      expect(page.answers()).toEqual([]);
    }
  );

  it('stops answering past 16 apps in one document', async () => {
    const page = await onAchievementsPage();
    for (let appid = 1; appid <= 20; appid++) {
      await page.ask({ payload: String(appid) });
    }
    expect(page.strings).toHaveBeenCalledTimes(16);
  });
});
