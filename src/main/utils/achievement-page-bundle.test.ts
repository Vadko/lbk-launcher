import vm from 'node:vm';
import source from '@lbk/bridge-core/achievement-page.iife.js?raw';
import { createPageInjector } from '@lbk/bridge-core/page-injector';
import type { BridgeSocket } from '@lbk/bridge-core/socket';
import { describe, expect, it } from 'vitest';

const PAGE = "globalThis[Symbol.for('lbk.achievementPage')]";

function pageContext(href: string): vm.Context {
  return vm.createContext({
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

  it('declares no window name and answers through its Symbol.for global', () => {
    expect(vm.runInContext(PAGE, runInPage('https://steamcommunity.com/id/x/'))).toBe(
      undefined
    );

    const ctx = runInPage('https://steamcommunity.com/achievements/620');
    expect(vm.runInContext(`${PAGE}.version`, ctx)).toBe(1);
    expect(vm.runInContext(`${PAGE}.wanted()`, ctx)).toEqual(['620']);
    vm.runInContext(`${PAGE}.dispose()`, ctx);
    expect(vm.runInContext(PAGE, ctx)).toBe(undefined);
    expect(Object.keys(ctx).sort()).toEqual(
      [
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
  });
});

describe('achievement page bundle under the Decky page injector', () => {
  it('asks for its app through the CDP binding and applies the answer', async () => {
    const cdp = new FakeCdp();
    const strings = { 'ACH.SURVIVE_CONTAINER_RIDE': { name: 'Підйом' } };
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
      strings: (appid) => Promise.resolve(appid === '620' ? strings : undefined),
    });
    injector.start();
    await settle();
    cdp.onopen?.(new Event('open'));
    cdp.replyAll();
    const targetInfo = {
      targetId: 'T',
      type: 'page',
      url: 'https://steamcommunity.com/achievements/620',
    };
    cdp.deliver({ method: 'Target.targetCreated', params: { targetInfo } });
    cdp.replyAll({ sessionId: 'S' });
    await settle();
    cdp.replyAll();
    await settle();

    const page = pageContext(targetInfo.url);
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
      params: { context: { id: 3, origin: 'https://steamcommunity.com' } },
      sessionId: 'S',
    });
    vm.runInContext(
      String(cdp.last('Page.addScriptToEvaluateOnNewDocument').params.source),
      page
    );
    expect(asked).toEqual(['620']);
    expect(vm.runInContext(`${PAGE}.wanted()`, page)).toEqual(['620']);

    await settle();
    const answer = cdp.last('Runtime.callFunctionOn');
    expect(answer.params).toMatchObject({
      executionContextId: 3,
      arguments: [{ value: '620' }, { value: strings }],
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
  });
});
