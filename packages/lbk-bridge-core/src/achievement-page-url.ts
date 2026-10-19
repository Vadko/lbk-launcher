// Every older stats URL (/stats/<appid>/achievements, ?tab=achievements, /compare) redirects to these.
const PAGE_URLS = [
  {
    kind: 'community',
    host: 'steamcommunity.com',
    path: /^\/(?:(?:id\/[\w-]+|profiles\/\d+)\/)?achievements\/([1-9]\d{0,9})\/?$/,
  },
  {
    kind: 'store',
    host: 'store.steampowered.com',
    path: /^\/app\/([1-9]\d{0,9})(?:\/[^/]+)?\/?$/,
  },
] as const;

export type AchievementPageKind = (typeof PAGE_URLS)[number]['kind'];

export interface AchievementPageMatch {
  kind: AchievementPageKind;
  appid: string;
}

// The origin of an execution context, as CDP reports it, that may show an achievements page.
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
    if (appid) {
      return { kind, appid };
    }
  }
  return undefined;
}
