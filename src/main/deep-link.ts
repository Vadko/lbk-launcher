import { type DeepLinkTarget, REVIEWS_TAB } from '@/shared/game-link-target';

export const DEEP_LINK_PROTOCOL = 'lbk';

// lbk://games/{slug}/{team}, or lbk:///games/{slug}/{team} where the host is empty
export function parseDeepLink(url: string): DeepLinkTarget | null {
  try {
    const urlObj = new URL(url);
    if (urlObj.protocol !== `${DEEP_LINK_PROTOCOL}:`) {
      return null;
    }

    const pathParts = urlObj.pathname.replace(/^\/+/, '').split('/');
    let parts: string[];
    if (urlObj.hostname === 'games') {
      parts = ['games', ...pathParts];
    } else if (pathParts[0] === 'games') {
      parts = pathParts;
    } else {
      return null;
    }

    if (parts.length >= 3 && parts[0] === 'games') {
      return {
        slug: decodeURIComponent(parts[1]),
        team: decodeURIComponent(parts[2]),
        openReviews: urlObj.searchParams.get('tab') === REVIEWS_TAB,
      };
    }
    return null;
  } catch (error) {
    console.error('[DeepLink] Failed to parse URL:', url, error);
    return null;
  }
}
