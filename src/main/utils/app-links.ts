import type { LinkApp } from '../../shared/types';
import { type AppOpener, openWithFallback } from './open-external';
import { openInSteamClient } from './steam-launcher';

const TELEGRAM_NAME = /^\w+$/;
const TELEGRAM_INVITE = /^[\w-]+$/;
const DISCORD_WEB_APP_HOSTS = new Set([
  'discord.com',
  'www.discord.com',
  'discordapp.com',
]);
const DISCORD_INVITE_HOSTS = new Set(['discord.gg', 'www.discord.gg']);
const STEAM_HOSTS = new Set(['store.steampowered.com', 'steamcommunity.com']);

// t.me paths as tg:// links (core.telegram.org/api/links): a channel or user, a post, an invite
function telegramAppUrl({ hostname, pathname }: URL): string | null {
  if (hostname !== 't.me') {
    return null;
  }
  const [first = '', second = ''] = pathname.split('/').filter(Boolean);
  const invite = first.startsWith('+')
    ? first.slice(1)
    : first === 'joinchat'
      ? second
      : null;
  if (invite !== null) {
    return TELEGRAM_INVITE.test(invite) ? `tg://join?invite=${invite}` : null;
  }
  if (!TELEGRAM_NAME.test(first)) {
    return null;
  }
  return /^\d+$/.test(second)
    ? `tg://resolve?domain=${first}&post=${second}`
    : `tg://resolve?domain=${first}`;
}

// The Discord client routes a discord: link's path the way its web app routes discord.com's
function discordAppUrl({ hostname, pathname }: URL): string | null {
  const host = hostname.toLowerCase();
  if (DISCORD_INVITE_HOSTS.has(host)) {
    const code = pathname.split('/').find(Boolean);
    return code ? `discord://-/invite/${code}` : null;
  }
  return DISCORD_WEB_APP_HOSTS.has(host) && pathname !== '/'
    ? `discord://-${pathname}`
    : null;
}

// Steam shows any of its own pages in the client, the store and Workshop alike
function steamAppUrl(url: URL): string | null {
  return STEAM_HOSTS.has(url.hostname.toLowerCase())
    ? `steam://openurl/${url.href}`
    : null;
}

interface AppLink {
  appUrl: (url: URL) => string | null;
  open?: AppOpener;
}

const APP_LINKS: Record<LinkApp, AppLink> = {
  telegram: { appUrl: telegramAppUrl },
  discord: { appUrl: discordAppUrl },
  steam: { appUrl: steamAppUrl, open: openInSteamClient },
};

export function appUrlFor(app: LinkApp, url: string): string | null {
  const parsed = URL.parse(url);
  return parsed ? APP_LINKS[app].appUrl(parsed) : null;
}

export function openAppLink(app: LinkApp, url: string): Promise<void> {
  return openWithFallback(appUrlFor(app, url), url, APP_LINKS[app].open);
}
