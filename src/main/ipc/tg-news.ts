import { ipcMain } from 'electron';
import DOMPurify from 'isomorphic-dompurify';
import type { NewsFeedFilter, NewsFeedItem } from '../../shared/types';

const NEWS_GROUP_ID = 'LittleBitUA';
const NEWS_FEED_URL = `https://rsshub.ktachibana.party/telegram/channel/${NEWS_GROUP_ID}`;
const NEWS_FEED_FILTERS: Record<NewsFeedFilter, string> = {
  'games-80': '#ігри_за_80',
  news: '#новини',
  updates: '#оновлення',
  ads: '#реклама',
  'people-search': '#пошук_людей',
};

interface NewsFeedResponse {
  items?: NewsFeedRawItem[];
}

interface NewsFeedRawItem {
  id?: string;
  url?: string;
  title?: string;
  summary?: string;
  content_html?: string;
  date_published?: string;
}

// const stripHtml = (value: string) =>
//   value
//     .replace(/<[^>]*>/g, ' ')
//     .replace(/\s+/g, ' ')
//     .trim();

DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if (node.tagName === 'A') {
    node.setAttribute('target', '_blank');
    node.setAttribute('rel', 'noopener noreferrer');
    node.classList.add('underline');
  }
});

const cleanHtml = (html: string) =>
  DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['br', 'p', 'b', 'strong', 'i', 'em', 'u', 'a', 'ul', 'ol', 'li'],
    ALLOWED_ATTR: ['href', 'target', 'rel', 'class'],
    ALLOWED_URI_REGEXP: /^(https?:|tg:)/i,
  });

const normalizeNewsFeedItem = (item: NewsFeedRawItem, index: number): NewsFeedItem => {
  const url = item.url || 'https://t.me/LittleBitUA';

  return {
    id: item.id || item.url || `news-feed-${index}`,
    url,
    title: item.title || 'Новина',
    content: item.content_html ? cleanHtml(item.content_html) : undefined,
    publishedAt: item.date_published,
  };
};

const buildNewsFeedUrl = (filter: NewsFeedFilter) => {
  const url = new URL(
    `${NEWS_FEED_URL}/searchQuery=${encodeURIComponent(NEWS_FEED_FILTERS[filter])}`
  );
  url.searchParams.set('format', 'json');
  url.searchParams.set('limit', '15');
  // url.searchParams.set('brief', '100');
  return url;
};

export function setupTgNewsHandlers(): void {
  ipcMain.handle(
    'fetch-news-feed',
    async (_, filter: NewsFeedFilter): Promise<NewsFeedItem[]> => {
      try {
        const response = await fetch(buildNewsFeedUrl(filter));

        if (!response.ok) {
          throw new Error(`RSSHub responded with ${response.status}`);
        }

        const data = (await response.json()) as NewsFeedResponse;
        return (data.items || []).map(normalizeNewsFeedItem);
      } catch (error) {
        console.error('[News] Error fetching news feed:', error);
        throw error;
      }
    }
  );
}
