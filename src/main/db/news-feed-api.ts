import type { NewsFeedFilter, NewsFeedItem } from '../../shared/types';
import { getSupabaseClient } from './supabase-client';

const PAGE_SIZE = 20;

export async function fetchNewsFeed(
  filter: NewsFeedFilter,
  before?: string
): Promise<NewsFeedItem[]> {
  const supabase = getSupabaseClient();

  const query = supabase
    .from('news_posts')
    .select('channel_username,telegram_message_id,title,content_html,posted_at')
    .contains('tags', [filter])
    .order('posted_at', { ascending: false })
    .limit(PAGE_SIZE);

  const { data, error } = await (before ? query.lt('posted_at', before) : query);

  if (error) {
    throw error;
  }

  return (data ?? []).map((row) => {
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
