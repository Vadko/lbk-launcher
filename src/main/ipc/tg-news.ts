import { ipcMain } from 'electron';
import DOMPurify from 'isomorphic-dompurify';
import type { NewsFeedFilter, NewsFeedItem } from '../../shared/types';

const NEWS_GROUP_ID = 'LittleBitUA';
const NEWS_FEED_URL = `https://rsshub.ktachibana.party/telegram/channel/${NEWS_GROUP_ID}`;
const NEWS_FEED_FILTERS: Record<NewsFeedFilter, string> = {
  sales: '#ігри_по_знижці',
  'games-80': '#ігри_за_80',
  news: '#lbk_новини',
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

const stripHtml = (value: string) =>
  value
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const normalizeComparableText = (value: string) =>
  value
    .replace(/^[\p{Extended_Pictographic}\p{Emoji_Presentation}\uFE0F\s]+/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

const isTitleDuplicatedInFirstLine = (firstLine: string, title: string) => {
  const normalizedFirstLine = normalizeComparableText(firstLine);
  const normalizedTitle = normalizeComparableText(title);

  if (!normalizedFirstLine || !normalizedTitle) {
    return false;
  }

  if (normalizedFirstLine === normalizedTitle) {
    return true;
  }

  const hasTrailingEllipsis = /(\.\.\.|…)\s*$/u.test(normalizedTitle);

  if (!hasTrailingEllipsis) {
    return false;
  }

  const normalizedTitlePrefix = normalizedTitle.replace(/(\.\.\.|…)\s*$/u, '').trim();

  if (normalizedTitlePrefix.length < 20) {
    return false;
  }

  return normalizedFirstLine.startsWith(normalizedTitlePrefix);
};

const removeLeadingTitleFromContent = (contentHtml: string, title: string) => {
  if (!title.trim()) {
    return contentHtml;
  }

  const firstParagraphMatch = contentHtml.match(/^<p>([\s\S]*?)<\/p>/i);

  if (!firstParagraphMatch) {
    return contentHtml;
  }

  const paragraphInnerHtml = firstParagraphMatch[1];
  const firstBreakMatch = paragraphInnerHtml.match(/<br\s*\/?>/i);

  const firstLineHtml = firstBreakMatch
    ? paragraphInnerHtml.slice(0, firstBreakMatch.index)
    : paragraphInnerHtml;

  if (!isTitleDuplicatedInFirstLine(stripHtml(firstLineHtml), title)) {
    return contentHtml;
  }

  const contentWithoutTitle = firstBreakMatch
    ? paragraphInnerHtml
        .slice((firstBreakMatch.index ?? 0) + firstBreakMatch[0].length)
        .replace(/^(\s*<br\s*\/?>\s*)+/i, '')
        .trim()
    : '';

  const updatedFirstParagraph = contentWithoutTitle
    ? `<p>${contentWithoutTitle}</p>`
    : '';

  return contentHtml
    .replace(/^<p>[\s\S]*?<\/p>/i, updatedFirstParagraph)
    .replace(/^\s+/, '')
    .trim();
};

const normalizeNewsFeedItem = (item: NewsFeedRawItem, index: number): NewsFeedItem => {
  const url = item.url || 'https://t.me/LittleBitUA';
  const title = item.title ? item.title.replace(/^(🖼|📹|🎵|📄)\s*/u, '') : 'Новина';
  const cleanedContent = item.content_html ? cleanHtml(item.content_html) : undefined;
  const content = cleanedContent
    ? removeLeadingTitleFromContent(cleanedContent, title)
    : undefined;

  return {
    id: item.id || item.url || `news-feed-${index}`,
    url,
    title,
    content,
    publishedAt: item.date_published,
  };
};

const buildNewsFeedUrl = (filter: NewsFeedFilter) => {
  const url = new URL(
    `${NEWS_FEED_URL}/searchQuery=${encodeURIComponent(NEWS_FEED_FILTERS[filter])}`
  );
  url.searchParams.set('format', 'json');
  url.searchParams.set('limit', '20');
  // Для обрізання контенту до 100 символів і видалення HTML тегів
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
