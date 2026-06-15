/**
 * Telegram News Feed Parser
 * Direct Telegram channel parser without external RSS service
 */

import * as cheerio from 'cheerio';
import { ipcMain } from 'electron';
import DOMPurify from 'isomorphic-dompurify';
import type { NewsFeedFilter, NewsFeedItem } from '../../shared/types';

// ============================================================================
// Constants
// ============================================================================

const NEWS_CHANNEL = 'LittleBitUA';
const LIMIT_POSTS = 20;
const NEWS_FEED_FILTERS: Record<NewsFeedFilter, string> = {
  sales: '#ігри_по_знижці',
  'games-80': '#ігри_за_80',
  news: '#lbk_новини',
};

// ============================================================================
// Types
// ============================================================================

interface TelegramMessage {
  id: string;
  url: string;
  rawTitle: string;
  contentHtml: string;
  images: string[];
  datePublished: string;
}

// ============================================================================
// HTML Utilities
// ============================================================================

// Configure DOMPurify for safe HTML
DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if (node.tagName === 'A') {
    node.setAttribute('target', '_blank');
    node.setAttribute('rel', 'noopener noreferrer');
    node.classList.add('underline');
  }
});

const cleanHtml = (html: string): string =>
  DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      'br',
      'p',
      'b',
      'strong',
      'i',
      'em',
      'u',
      'a',
      'ul',
      'ol',
      'li',
      'span',
    ],
    ALLOWED_ATTR: ['href', 'target', 'rel', 'class'],
    ALLOWED_URI_REGEXP: /^(https?:|tg:)/i,
  });

// ============================================================================
// Telegram Parser
// ============================================================================

/**
 * Parse HTML messages from Telegram channel
 */
function parseTelegramMessages(html: string): TelegramMessage[] {
  const $ = cheerio.load(html);
  const messages: TelegramMessage[] = [];

  $('.tgme_widget_message_wrap').each((_, el) => {
    const $msg = $(el).find('.tgme_widget_message');
    const messageId = $msg.attr('data-post');

    if (!messageId) return;

    const postId = messageId.split('/')[1];
    const postUrl = `https://t.me/${NEWS_CHANNEL}/${postId}`;

    // Get message text
    const $text = $msg.find('.tgme_widget_message_text');
    let contentHtml = $text.html() || '';

    // Simplify emoji
    contentHtml = contentHtml.replace(
      /<i class="emoji"[^>]*><b>([^<]*)<\/b><\/i>/g,
      '<span class="emoji">$1</span>'
    );

    // Absolute links for hashtags
    contentHtml = contentHtml.replace(/href="\?q=/g, `href="${postUrl}?q=`);

    // Parse images
    const images: string[] = [];

    // Images from photos
    $msg.find('.tgme_widget_message_photo_wrap').each((__, photo) => {
      const style = $(photo).attr('style') || '';
      const match = style.match(/url\(['"]?(.*?)['"]?\)/);
      if (match) images.push(match[1]);
    });

    // Video preview
    const $video = $msg.find('.tgme_widget_message_video_thumb');
    if ($video.length) {
      const style = $video.attr('style') || '';
      const match = style.match(/url\(['"]?(.*?)['"]?\)/);
      if (match) images.push(match[1]);
    }

    // Publication date
    const $time = $msg.find('.tgme_widget_message_date time');
    const datetime = $time.attr('datetime') || new Date().toISOString();

    // Title - first line of text
    const textWithBreaks = $text.html()?.replace(/<br\s*\/?>/gi, '\n') || '';
    const $tempText = cheerio.load(`<div>${textWithBreaks}</div>`);
    let rawTitle = $tempText('div').text().trim().split('\n')[0] || '';

    // Truncate long titles
    if (rawTitle.length > 100) {
      rawTitle = `${rawTitle.substring(0, 97)}...`;
    }

    // Remove first paragraph from content (as it becomes the title)
    const contentParts = contentHtml.split(/<br\s*\/?>\s*<br\s*\/?>/i);
    if (contentParts.length > 1) {
      contentHtml = contentParts.slice(1).join('<br><br>');
    }

    messages.push({
      id: postUrl,
      url: postUrl,
      rawTitle,
      contentHtml: `<p>${contentHtml}</p>`,
      images,
      datePublished: datetime,
    });
  });

  return messages.reverse(); // From oldest to newest
}

/**
 * Normalize message to NewsFeedItem
 * Clean HTML using DOMPurify for security
 */
function normalizeMessage(message: TelegramMessage): NewsFeedItem {
  const title = message.rawTitle || 'Новина';
  const cleanedContent = cleanHtml(message.contentHtml);

  return {
    id: message.id,
    url: message.url,
    title,
    content: cleanedContent || undefined,
    publishedAt: message.datePublished,
  };
}

/**
 * Fetch posts from Telegram channel by filter
 */
async function fetchTelegramChannel(filter: NewsFeedFilter): Promise<NewsFeedItem[]> {
  const searchQuery = NEWS_FEED_FILTERS[filter];
  const url = `https://t.me/s/${NEWS_CHANNEL}?q=${encodeURIComponent(searchQuery)}`;

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'uk-UA,uk;q=0.9,en;q=0.8',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch Telegram channel: ${response.status}`);
    }

    const html = await response.text();
    const messages = parseTelegramMessages(html);

    // Normalize and limit to LIMIT_POSTS messages
    return messages.slice(0, LIMIT_POSTS).map(normalizeMessage);
  } catch (error) {
    console.error('[TelegramNews] Error fetching news feed:', error);
    throw error;
  }
}

// ============================================================================
// IPC Handlers
// ============================================================================

export function setupTgNewsHandlers(): void {
  ipcMain.handle(
    'fetch-news-feed',
    async (_, filter: NewsFeedFilter): Promise<NewsFeedItem[]> => {
      try {
        return await fetchTelegramChannel(filter);
      } catch (error) {
        console.error('[TelegramNews] Error in IPC handler:', error);
        throw error;
      }
    }
  );
}
