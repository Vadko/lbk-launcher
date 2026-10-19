import vm from 'node:vm';
import source from '@lbk/bridge-core/achievement-page.iife.js?raw';
import { describe, expect, it } from 'vitest';

const PAGE = "globalThis[Symbol.for('lbk.achievementPage')]";

function runInPage(href: string): vm.Context {
  const ctx = vm.createContext({
    location: { href },
    console,
    setTimeout,
    clearTimeout,
    queueMicrotask,
    AbortController,
    AbortSignal,
    URL,
  });
  vm.runInContext(source, ctx);
  return ctx;
}

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
