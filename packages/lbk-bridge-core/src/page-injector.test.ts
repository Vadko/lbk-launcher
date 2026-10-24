import { afterEach, describe, expect, it, vi } from 'vitest';
import { pageHintSource } from './achievement-page-hint';
import type { AppStrings } from './achievement-text';
import type { PageInjector } from './page-injector';
import {
  BROWSER,
  COMMUNITY,
  type FakeCdp,
  injectorHarness,
  PORTAL2,
  SCRIPT,
  settle,
} from './page-injector.fixture';

const running: PageInjector[] = [];
afterEach(() => {
  for (const injector of running.splice(0)) {
    injector.dispose();
  }
  vi.restoreAllMocks();
});

function setUp(version?: unknown) {
  const steam = injectorHarness(version);
  running.push(steam.injector);
  return steam;
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

// What Steam's main window shows while the library is open.
const LIBRARY = 'data:text/html,<html><body></body></html><!--tracking:library-->';

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
    ['the library placeholder', false, 'page', LIBRARY],
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
    expect(source.startsWith(`${pageHintSource([])}\n${SCRIPT}\n`)).toBe(true);
    expect(source).toContain(`globalThis.${String(binding.params.name)}`);
    expect(evaluate.params).toEqual({ expression: source });
  });

  it.each([
    ['Steam UI', 'https://steamloopback.host/routes/library/home', true],
    ['another site', 'https://example.com/', true],
    ['about:blank', 'about:blank', false],
    ['the library placeholder', LIBRARY, false],
    ['the store', 'https://store.steampowered.com/app/620/Portal_2/', false],
    ['the games list of a profile', 'https://steamcommunity.com/id/x/games', false],
  ])('when a page moves to %s and back detaches: %s', async (_label, url, detaches) => {
    const steam = setUp();
    const ws = await steam.connect();
    const sessionId = await steam.attach('T1');
    const sent = ws.sent.length;
    for (const next of [url, COMMUNITY]) {
      ws.emit('Target.targetInfoChanged', {
        targetInfo: { targetId: 'T1', type: 'page', url: next },
      });
    }
    expect(ws.find('Target.detachFromTarget').map((c) => c.params)).toEqual(
      detaches ? [{ sessionId }] : []
    );
    // A kept session's document-start script already covers the next achievements page.
    expect(ws.sent.slice(sent).map((c) => c.method)).toEqual(
      detaches ? ['Target.detachFromTarget', 'Target.attachToTarget'] : []
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

  it('stops answering past 256 apps in one document', async () => {
    const page = await onAchievementsPage();
    for (let appid = 1; appid <= 260; appid++) {
      await page.ask({ payload: String(appid) });
    }
    expect(page.strings).toHaveBeenCalledTimes(256);
  });
});

describe('page injector: document-start hint', () => {
  const ADD = 'Page.addScriptToEvaluateOnNewDocument';
  const REMOVE = 'Page.removeScriptToEvaluateOnNewDocument';
  const sources = (ws: FakeCdp, sessionId: string) =>
    ws.find(ADD, sessionId).map((c) => String(c.params.source));
  const withHint = (appids: string[]) => `${pageHintSource(appids)}\n${SCRIPT}\n`;

  it('registers the current hint for a session attached later, and runs it in the open document', async () => {
    const steam = setUp();
    steam.injector.setHint(['620', '400']);
    const ws = await steam.connect();
    const sessionId = await steam.attach('T1');

    const [source] = sources(ws, sessionId);
    expect(source.startsWith(withHint(['400', '620']))).toBe(true);
    expect(ws.find('Runtime.evaluate', sessionId)[0].params).toEqual({
      expression: source,
    });
  });

  it('swaps the script on every live session: the removal and the new script go out back to back', async () => {
    const steam = setUp();
    const ws = await steam.connect();
    const sessions = [await steam.attach('T1'), await steam.attach('T2')];
    const before = sessions.map((sessionId) => ws.find(ADD, sessionId)[0].id);

    steam.injector.setHint(['620']);
    await settle();
    for (const [i, sessionId] of sessions.entries()) {
      const swap = ws.sent
        .filter(
          (c) => c.sessionId === sessionId && (c.method === ADD || c.method === REMOVE)
        )
        .slice(1);
      expect(swap.map((c) => c.method)).toEqual([REMOVE, ADD]);
      expect(swap[0].params).toEqual({ identifier: `script-${before[i]}` });
      expect(String(swap[1].params.source).startsWith(withHint(['620']))).toBe(true);
    }
  });

  it('removes the swapped-in script on the next change', async () => {
    const steam = setUp();
    const ws = await steam.connect();
    const sessionId = await steam.attach('T1');

    steam.injector.setHint(['620']);
    await settle();
    ws.reply(REMOVE, {}, sessionId);
    ws.reply(ADD, {}, sessionId);
    await settle();
    const swapped = ws.find(ADD, sessionId)[1].id;
    steam.injector.setHint(['400']);
    await settle();
    expect(ws.find(REMOVE, sessionId).map((c) => c.params)).toEqual([
      { identifier: `script-${ws.find(ADD, sessionId)[0].id}` },
      { identifier: `script-${swapped}` },
    ]);
    expect(sources(ws, sessionId)[2].startsWith(withHint(['400']))).toBe(true);
  });

  it('sends nothing when the apps did not change', async () => {
    const steam = setUp();
    steam.injector.setHint(['620']);
    const ws = await steam.connect();
    const sessionId = await steam.attach('T1');
    const sent = ws.sent.length;

    steam.injector.setHint(['620', '0620']);
    await settle();
    expect(ws.sent).toHaveLength(sent);
    expect(ws.methods(sessionId)).not.toContain(REMOVE);
  });

  it('swaps a script whose registration was still on its way when the hint changed', async () => {
    const steam = setUp();
    const ws = await steam.connect();
    ws.emit('Target.targetCreated', {
      targetInfo: { targetId: 'T1', type: 'page', url: COMMUNITY },
    });
    ws.reply('Target.attachToTarget', { sessionId: 'ST1' });
    await settle();
    steam.injector.setHint(['620']);
    await settle();
    expect(ws.methods('ST1').filter((m) => m === ADD || m === REMOVE)).toEqual([ADD]);

    ws.reply(ADD, {}, 'ST1');
    await settle();
    ws.reply(REMOVE, {}, 'ST1');
    await settle();
    expect(ws.methods('ST1').filter((m) => m === ADD || m === REMOVE)).toEqual([
      ADD,
      REMOVE,
      ADD,
    ]);
    expect(sources(ws, 'ST1')[1].startsWith(withHint(['620']))).toBe(true);
  });

  it('detaches a session whose script could not be swapped', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const steam = setUp();
    const ws = await steam.connect();
    const sessionId = await steam.attach('T1');

    steam.injector.setHint(['620']);
    await settle();
    ws.fail(REMOVE, sessionId);
    await settle();
    expect(ws.find('Target.detachFromTarget').map((c) => c.params)).toEqual([
      { sessionId },
    ]);
  });

  it('keeps the hint across a reconnect', async () => {
    const steam = setUp();
    const first = await steam.connect();
    steam.injector.setHint(['620']);
    first.drop();
    await settle();
    await steam.runRetry();
    const ws = steam.cdp();
    ws.open();
    ws.reply('Target.setDiscoverTargets');
    await settle();
    const sessionId = await steam.attach('T1');
    expect(sources(ws, sessionId)[0].startsWith(withHint(['620']))).toBe(true);
  });
});
