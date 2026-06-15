import got from 'got';
import {
  NEWS_PAGE_SIZE,
  type NewsFeedFilter,
  type NewsFeedItem,
} from '../../shared/types';
import { getSupabaseCredentials } from './supabase-credentials';

const REQUEST_TIMEOUT = { connect: 5000, response: 10_000 };

interface NewsPostRow {
  channel_username: string;
  telegram_message_id: number;
  title: string | null;
  content_html: string | null;
  posted_at: string;
}

export async function fetchNewsFeed(
  filter: NewsFeedFilter,
  before?: string
): Promise<NewsFeedItem[]> {
  const { SUPABASE_URL, SUPABASE_ANON_KEY } = getSupabaseCredentials();

  const params = new URLSearchParams({
    select: 'channel_username,telegram_message_id,title,content_html,posted_at',
    tags: `cs.{${filter}}`,
    order: 'posted_at.desc',
    limit: String(NEWS_PAGE_SIZE),
  });
  if (before) params.set('posted_at', `lt.${before}`);

  const url = `${SUPABASE_URL}/rest/v1/news_posts?${params.toString()}`;

  const response = await got<NewsPostRow[]>(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      apikey: SUPABASE_ANON_KEY,
    },
    responseType: 'json',
    timeout: REQUEST_TIMEOUT,
  });

  return response.body.map((row) => {
    const postUrl = `https://t.me/${row.channel_username}/${row.telegram_message_id}`;
    return {
      id: postUrl,
      url: postUrl,
      title: row.title ?? undefined,
      content: row.content_html ?? undefined,
      publishedAt: row.posted_at,
    };
  });
}
