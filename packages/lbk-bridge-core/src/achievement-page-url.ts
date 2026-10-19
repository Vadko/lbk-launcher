const APP_ID = /^[1-9]\d{0,9}$/;

// Symbol.for() key of the page module's per-document global.
export const PAGE_GLOBAL_KEY = 'lbk.achievementPage';

// A Steam app id as page URLs, the query cache and the hosts pass it: decimal, no leading zero.
export const isAppId = (id: string): boolean => APP_ID.test(id);

// Every older stats URL (/stats/<appid>/achievements, ?tab=achievements, /compare) redirects to these.
const PAGE_URLS = [
  {
    kind: 'community',
    host: 'steamcommunity.com',
    path: /^\/(?:(?:id\/[\w-]+|profiles\/\d+)\/)?achievements\/(\d+)\/?$/,
  },
  {
    kind: 'store',
    host: 'store.steampowered.com',
    path: /^\/app\/(\d+)(?:\/[^/]+)?\/?$/,
  },
] as const;

export type AchievementPageKind = (typeof PAGE_URLS)[number]['kind'];

export interface AchievementPageMatch {
  kind: AchievementPageKind;
  appid: string;
}

// The origin of an execution context or a target, as CDP reports it, that may show an achievements page.
export const isAchievementPageOrigin = (origin: string): boolean =>
  PAGE_URLS.some(({ host }) => origin === `https://${host}`);

export function matchAchievementPage(href: string): AchievementPageMatch | undefined {
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return undefined;
  }
  if (url.protocol !== 'https:') {
    return undefined;
  }
  for (const { kind, host, path } of PAGE_URLS) {
    const appid = url.hostname === host ? path.exec(url.pathname)?.[1] : undefined;
    if (appid && isAppId(appid)) {
      return { kind, appid };
    }
  }
  return undefined;
}
