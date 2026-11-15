import type { NewsFeedCursor, NewsFeedFilter, NewsFeedItem } from '../../shared/types';
import { getSupabaseClient } from './supabase-client';
import { beforeCursor } from './sync-cursor';

const PAGE_SIZE = 20;

export async function fetchNewsFeed(
  filter: NewsFeedFilter,
  before?: NewsFeedCursor
): Promise<NewsFeedItem[]> {
  const supabase = getSupabaseClient();

  const query = supabase
    .from('news_posts')
    .select('id,channel_username,telegram_message_id,title,content_html,posted_at')
    .contains('tags', [filter])
    .order('posted_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(PAGE_SIZE);

  // posted_at has whole-second precision, so posts from one second straddle a page without the id
  const { data, error } = await (before
    ? query.or(beforeCursor('posted_at', before.publishedAt, 'id', before.postId))
    : query);

  if (error) {
    throw error;
  }

  return (data ?? []).map((row) => {
    const postUrl = `https://t.me/${row.channel_username}/${row.telegram_message_id}`;
    return {
      id: postUrl,
      postId: row.id,
      url: postUrl,
      title: row.title ?? undefined,
      content: row.content_html ?? undefined,
      publishedAt: row.posted_at,
    };
  });
}
