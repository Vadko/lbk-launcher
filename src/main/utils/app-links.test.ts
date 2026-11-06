import { beforeEach, describe, expect, it, vi } from 'vitest';
import { appUrlFor, openAppLink } from './app-links';

const links = vi.hoisted(() => ({
  openWithFallback: vi.fn(() => Promise.resolve()),
  openInSteamClient: vi.fn(() => Promise.resolve(true)),
}));

vi.mock('./open-external', () => ({ openWithFallback: links.openWithFallback }));
vi.mock('./steam-launcher', () => ({ openInSteamClient: links.openInSteamClient }));

beforeEach(() => {
  links.openWithFallback.mockClear();
});

describe('appUrlFor', () => {
  it.each([
    ['https://t.me/LBK_news', 'tg://resolve?domain=LBK_news'],
    ['https://t.me/VHt_5#', 'tg://resolve?domain=VHt_5'],
    ['https://t.me/LBK_news/1234', 'tg://resolve?domain=LBK_news&post=1234'],
    ['https://t.me/+AbC-12_x', 'tg://join?invite=AbC-12_x'],
    ['https://t.me/joinchat/AbC-12', 'tg://join?invite=AbC-12'],
  ])('maps the Telegram link %s to %s', (url, appUrl) => {
    expect(appUrlFor('telegram', url)).toBe(appUrl);
  });

  it.each([
    ['https://discord.gg/hVX56HTZVm', 'discord://-/invite/hVX56HTZVm'],
    ['https://www.discord.gg/hVX56HTZVm/', 'discord://-/invite/hVX56HTZVm'],
    ['https://discord.com/invite/hVX56HTZVm', 'discord://-/invite/hVX56HTZVm'],
    [
      'https://discord.com/users/645338224407085070',
      'discord://-/users/645338224407085070',
    ],
    [
      'https://discordapp.com/users/688446200822890564',
      'discord://-/users/688446200822890564',
    ],
    ['https://discord.com/channels/1/2', 'discord://-/channels/1/2'],
  ])('maps the Discord link %s to %s', (url, appUrl) => {
    expect(appUrlFor('discord', url)).toBe(appUrl);
  });

  it.each([
    [
      'https://store.steampowered.com/app/620/',
      'steam://openurl/https://store.steampowered.com/app/620/',
    ],
    [
      'https://steamcommunity.com/sharedfiles/filedetails/?id=3045623890',
      'steam://openurl/https://steamcommunity.com/sharedfiles/filedetails/?id=3045623890',
    ],
  ])('maps the Steam link %s to %s', (url, appUrl) => {
    expect(appUrlFor('steam', url)).toBe(appUrl);
  });

  it.each([
    ['https://store.epicgames.com/p/limbo', 'com.epicgames.launcher://store/p/limbo'],
    [
      'https://store.epicgames.com/uk/p/chants-of-sennaar?lang=uk',
      'com.epicgames.launcher://store/p/chants-of-sennaar',
    ],
    [
      'https://www.epicgames.com/store/uk/p/monument-valley-2-addd02/',
      'com.epicgames.launcher://store/p/monument-valley-2-addd02',
    ],
  ])('maps the Epic link %s to %s', (url, appUrl) => {
    expect(appUrlFor('epic', url)).toBe(appUrl);
  });

  it.each([
    ['epic', 'https://store.epicgames.com/uk/'],
    ['epic', 'https://store.epicgames.com/p/..'],
    ['epic', 'https://store.epicgames.com/p/a%20b'],
    ['epic', 'https://example.test/p/limbo'],
    ['steam', 'https://steamdb.info/app/620/'],
    [
      'telegram',
      'https://steamcommunity.com/linkfilter/?u=https%3A%2F%2Ft.me%2Fanime_watchman',
    ],
    ['telegram', 'https://t.me/'],
    ['telegram', 'not a url'],
    ['discord', 'https://discord.com/'],
    ['discord', 'https://discord.gg/'],
    ['discord', 'https://example.test/x'],
  ] as const)('leaves the %s link %s to the browser', (app, url) => {
    expect(appUrlFor(app, url)).toBeNull();
  });
});

describe('openAppLink', () => {
  it('opens the app link, with the link itself as the fallback', async () => {
    await openAppLink('telegram', 'https://t.me/LBK_news/1234');

    expect(links.openWithFallback).toHaveBeenCalledWith(
      'tg://resolve?domain=LBK_news&post=1234',
      'https://t.me/LBK_news/1234',
      undefined
    );
  });

  it('opens a Steam link through the Steam launch path', async () => {
    await openAppLink('steam', 'https://store.steampowered.com/app/620/');

    expect(links.openWithFallback).toHaveBeenCalledWith(
      'steam://openurl/https://store.steampowered.com/app/620/',
      'https://store.steampowered.com/app/620/',
      links.openInSteamClient
    );
  });

  it('passes no app link when the link has no app form', async () => {
    await openAppLink('discord', 'https://example.test/x');

    expect(links.openWithFallback).toHaveBeenCalledWith(
      null,
      'https://example.test/x',
      undefined
    );
  });
});
