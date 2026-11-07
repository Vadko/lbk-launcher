import { describe, expect, it, vi } from 'vitest';

vi.mock('@/main/steam-process/lifecycle', () => ({ findSteamPids: vi.fn() }));
vi.mock('@/main/utils/steam-cef-discovery', () => ({ discoverCefEndpoint: vi.fn() }));

const { isSharedJsContext } = await import('./steam-cef');

describe('isSharedJsContext', () => {
  it.each<[string, string, string, boolean]>([
    [
      'the shared context',
      'SharedJSContext',
      'https://steamloopback.host/index.html?LOCAL_HOSTNAME=pc&LANGUAGE=ukrainian',
      true,
    ],
    [
      'the shared context on a Game Mode route',
      'SharedJSContext',
      'https://steamloopback.host/routes/library/home',
      true,
    ],
    [
      'a store page that took the title',
      'SharedJSContext',
      'https://store.steampowered.com/marketingmessages/list/?os_type=-67',
      false,
    ],
    [
      'a lookalike host',
      'SharedJSContext',
      'https://steamloopback.host.example/index.html',
      false,
    ],
    [
      'a page that names it in its path',
      'SharedJSContext',
      'https://example.com/https://steamloopback.host/index.html',
      false,
    ],
    ['plain http', 'SharedJSContext', 'http://steamloopback.host/index.html', false],
    ['a Steam window', 'Steam', 'about:blank?createflags=18&pid=0&browser=-1', false],
    [
      'another page of the Steam UI',
      'Steam Big Picture Mode',
      'https://steamloopback.host/routes/library/home',
      false,
    ],
    ['a URL that does not parse', 'SharedJSContext', 'not a url', false],
  ])('%s', (_case, title, url, expected) => {
    expect(isSharedJsContext({ title, url })).toBe(expected);
  });
});
