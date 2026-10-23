import * as fs from 'node:fs';
import * as path from 'node:path';
import vm from 'node:vm';
import { G } from '@mobily/ts-belt';
import { describe, expect, it } from 'vitest';

const MILLENNIUM_WEBKIT = path.resolve(
  __dirname,
  '../../../packages/lbk-bridge-millennium/.millennium/Dist/webkit.js'
);

const settle = () => new Promise((resolve) => setTimeout(resolve, 50));

describe('Millennium webkit bundle', () => {
  const source = fs.readFileSync(MILLENNIUM_WEBKIT, 'utf8');
  const PLUGIN_DIR = 'https://millennium.ftp/C:/Program%20Files%20(x86)/Steam/plugins';
  const OWN_SCRIPT = `${PLUGIN_DIR}/lbk-bridge/.millennium/Dist/webkit.js`;
  const PAGE = Symbol.for('lbk.achievementPage');

  // Millennium appends one millennium-injected tag per plugin to every Steam web page.
  const loadInPage = (href: string) => {
    const fetched: { url: string; init: unknown }[] = [];
    let scriptReads = 0;
    const location = { href };
    const navigation = new EventTarget();
    const scripts = [
      { src: `${PLUGIN_DIR}/other/.millennium/Dist/webkit.js` },
      { src: OWN_SCRIPT },
    ];
    const sandbox: Record<string, unknown> = {
      console,
      URL,
      AbortController,
      AbortSignal,
      location,
      navigation,
      document: {
        get scripts() {
          scriptReads += 1;
          return scripts;
        },
      },
      fetch: (url: string, init: unknown) => {
        fetched.push({ url, init });
        const body = { v: 1, stamp: 's', apps: { 620: { A: { name: 'Yes' } } } };
        return Promise.resolve({ ok: true, json: () => Promise.resolve(body) });
      },
      setTimeout: () => 0,
      clearTimeout: () => undefined,
    };
    sandbox.window = sandbox;
    vm.runInContext(source, vm.createContext(sandbox), { filename: 'webkit.js' });
    // What Steam's router does on a link to another page of the same site.
    const navigate = (next: string) => {
      location.href = next;
      navigation.dispatchEvent(new Event('currententrychange'));
    };
    return { sandbox, fetched, scriptReads: () => scriptReads, navigate };
  };
  const dispose = (sandbox: object) => {
    const handle: unknown = Reflect.get(sandbox, PAGE);
    if (G.isObject(handle) && typeof handle.dispose === 'function') {
      handle.dispose();
    }
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

  it.each([
    'https://help.steampowered.com/en/',
    'https://steamcommunity.com.example.net/achievements/620',
    'https://www.youtube.com/watch?v=x',
  ])('leaves %s before it looks for anything', async (href) => {
    const page = loadInPage(href);
    page.navigate('https://steamcommunity.com/achievements/620');
    await settle();
    expect(page.fetched).toEqual([]);
    expect(page.scriptReads()).toBe(0);
    expect(Reflect.get(page.sandbox, PAGE)).toBeUndefined();
  });

  it.each([
    [
      'https://steamcommunity.com/id/someone/games/?tab=all',
      'https://steamcommunity.com/id/someone/achievements/620',
    ],
    [
      'https://store.steampowered.com/search/?term=portal',
      'https://store.steampowered.com/app/620/Portal_2/',
    ],
  ])(
    'waits on %s and reads achievements.json once the router reaches %s',
    async (href, next) => {
      const page = loadInPage(href);
      page.navigate(`${href}&page=2`);
      await settle();
      expect(page.fetched).toEqual([]);
      expect(Reflect.get(page.sandbox, PAGE)).toMatchObject({ version: 5 });

      page.navigate(next);
      await settle();
      expect(page.fetched).toHaveLength(1);
      dispose(page.sandbox);
    }
  );

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
    expect(handle).toMatchObject({ version: 5 });
    if (G.isObject(handle) && typeof handle.wanted === 'function') {
      expect(handle.wanted()).toEqual([]);
    }
    dispose(page.sandbox);
  });
});
