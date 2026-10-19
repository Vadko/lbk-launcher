import vm from 'node:vm';
import source from '@lbk/bridge-core/achievement-page.iife.js?raw';
import { createPageInjector } from '@lbk/bridge-core/page-injector';
import type { BridgeSocket } from '@lbk/bridge-core/socket';
import { describe, expect, it } from 'vitest';

const PAGE = "globalThis[Symbol.for('lbk.achievementPage')]";

function pageContext(href: string, extra: object = {}): vm.Context {
  return vm.createContext({
    ...extra,
    location: { href },
    console,
    setTimeout,
    clearTimeout,
    queueMicrotask,
    AbortController,
    AbortSignal,
    URL,
  });
}

function runInPage(href: string): vm.Context {
  const ctx = pageContext(href);
  vm.runInContext(source, ctx);
  return ctx;
}

interface Command {
  id: number;
  method: string;
  params: Record<string, unknown>;
  sessionId?: string;
}

// Plays Steam CEF's side of the browser socket.
class FakeCdp implements BridgeSocket {
  readyState = 1;
  sent: Command[] = [];
  onopen: ((ev: Event) => void) | null = null;
  onmessage: ((ev: MessageEvent) => void) | null = null;
  onerror: ((ev: Event) => void) | null = null;
  onclose: ((ev: CloseEvent) => void) | null = null;
  send(data: string): void {
    this.sent.push(JSON.parse(data));
  }
  close(): void {
    this.readyState = 3;
  }
  deliver(message: object): void {
    this.onmessage?.(new MessageEvent('message', { data: JSON.stringify(message) }));
  }
  replyAll(result: object = {}): void {
    for (const { id } of this.sent) {
      this.deliver({ id, result });
    }
  }
  last(method: string): Command {
    const command = this.sent.findLast((c) => c.method === method);
    if (!command) {
      throw new Error(`${method} was not sent`);
    }
    return command;
  }
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('achievement page bundle', () => {
  // A Decky host evaluates it in every new document of Steam's main window.
  it('stays small', () => {
    expect(source.length).toBeLessThan(32 * 1024);
  });

  // Web pages get public achievement strings and nothing that reaches LBK; Steam's CSP may forbid eval.
  it.each([
    ['runtime code compilation', /\bFunction\b|\beval\(/],
    ['WebSocket', /WebSocket/],
    ['bridge.json', /bridge\.json/],
    ['localStorage', /localStorage/],
    ['zod', /_zod|\bzod\b/],
  ])('contains no %s', (_label, pattern) => {
    expect(source).not.toMatch(pattern);
  });

  it('starts no copy off the achievements sites', () => {
    expect(vm.runInContext(PAGE, runInPage('https://help.steampowered.com/en/'))).toBe(
      undefined
    );
  });

  // Another page of the same site gets a copy that waits for a client-side navigation.
  it.each([
    ['https://steamcommunity.com/achievements/620', {}, ['620']],
    ['https://steamcommunity.com/id/x/', { navigation: new EventTarget() }, []],
  ])(
    'declares no window name on %s and answers through its Symbol.for global',
    (href, extra, wanted) => {
      const ctx = pageContext(href, extra);
      vm.runInContext(source, ctx);
      expect(vm.runInContext(`${PAGE}.version`, ctx)).toBe(3);
      expect(vm.runInContext(`${PAGE}.wanted()`, ctx)).toEqual(wanted);
      vm.runInContext(`${PAGE}.dispose()`, ctx);
      expect(vm.runInContext(PAGE, ctx)).toBe(undefined);
      expect(Object.keys(ctx).sort()).toEqual(
        [
          ...Object.keys(extra),
          'location',
          'console',
          'setTimeout',
          'clearTimeout',
          'queueMicrotask',
          'AbortController',
          'AbortSignal',
          'URL',
        ].sort()
      );
    }
  );
});

const STRINGS = { 'ACH.SURVIVE_CONTAINER_RIDE': { name: 'Підйом' } };
const targetInfo = {
  targetId: 'T',
  type: 'page',
  url: 'https://steamcommunity.com/achievements/620',
};

// Attaches the injector to one achievements page target and returns what it registered for new documents.
async function injectInto(hint: string[] = []) {
  const cdp = new FakeCdp();
  const injector = createPageInjector({
    env: {
      fetchJson: () =>
        Promise.resolve({
          webSocketDebuggerUrl: 'ws://127.0.0.1:8080/devtools/browser/x',
        }),
      openSocket: () => cdp,
      setTimeout,
      clearTimeout,
    },
    script: source,
    strings: (appid) => Promise.resolve(appid === '620' ? STRINGS : undefined),
  });
  injector.setHint(hint);
  injector.start();
  await settle();
  cdp.onopen?.(new Event('open'));
  cdp.replyAll();
  cdp.deliver({ method: 'Target.targetCreated', params: { targetInfo } });
  cdp.replyAll({ sessionId: 'S' });
  await settle();
  cdp.replyAll({ identifier: '1' });
  await settle();
  const registered = String(
    cdp.last('Page.addScriptToEvaluateOnNewDocument').params.source
  );
  return { cdp, injector, registered };
}

class FakeSheet {
  css = '';
  replaceSync(css: string): void {
    this.css = css;
  }
}

describe('achievement page bundle under the Decky page injector', () => {
  it('hides the rows at document start when the hint names the app, and leaves no hint on the page', async () => {
    const { injector, registered } = await injectInto(['620']);
    const document = { readyState: 'loading', adoptedStyleSheets: [] };
    const page = pageContext(targetInfo.url, { document, CSSStyleSheet: FakeSheet });
    vm.runInContext(registered, page);

    expect(document.adoptedStyleSheets).toHaveLength(1);
    expect(Object.getOwnPropertySymbols(page).map(String)).toEqual([
      'Symbol(lbk.achievementPage)',
    ]);
    vm.runInContext(`${PAGE}.dispose()`, page);
    expect(document.adoptedStyleSheets).toHaveLength(0);
    injector.dispose();
  });

  // The profile's games list links every game's achievements page, and Steam's router opens it without a new document.
  it.each([
    ['opened on it', targetInfo.url, null],
    ['routed to it', 'https://steamcommunity.com/id/x/games/?tab=all', targetInfo.url],
  ])(
    'asks for its app through the CDP binding and applies the answer when %s',
    async (_label, opened, routedTo) => {
      const { cdp, injector, registered } = await injectInto();
      const navigation = new EventTarget();
      const page = pageContext(opened, { navigation });
      const asked: unknown[] = [];
      const binding = String(cdp.last('Runtime.addBinding').params.name);
      page[binding] = (payload: unknown) => {
        asked.push(payload);
        cdp.deliver({
          method: 'Runtime.bindingCalled',
          params: { name: binding, payload, executionContextId: 3 },
          sessionId: 'S',
        });
      };
      cdp.deliver({
        method: 'Runtime.executionContextCreated',
        params: {
          context: { id: 3, origin: 'https://steamcommunity.com', uniqueId: 'u3' },
        },
        sessionId: 'S',
      });
      vm.runInContext(registered, page);
      if (routedTo) {
        expect(asked).toEqual([]);
        vm.runInContext(`location.href = ${JSON.stringify(routedTo)}`, page);
        navigation.dispatchEvent(new Event('currententrychange'));
      }
      expect(asked).toEqual(['620']);
      expect(vm.runInContext(`${PAGE}.wanted()`, page)).toEqual(['620']);

      await settle();
      const answer = cdp.last('Runtime.callFunctionOn');
      expect(answer.params).toMatchObject({
        uniqueContextId: 'u3',
        arguments: [{ value: '620' }, { value: STRINGS }],
      });
      const provide: unknown = vm.runInContext(
        `(${String(answer.params.functionDeclaration)})`,
        page
      );
      const args = answer.params.arguments;
      if (typeof provide === 'function' && Array.isArray(args)) {
        provide(...args.map((arg: { value: unknown }) => arg.value));
      }
      expect(vm.runInContext(`${PAGE}.wanted()`, page)).toEqual([]);

      vm.runInContext(`${PAGE}.dispose()`, page);
      injector.dispose();
    }
  );
});
