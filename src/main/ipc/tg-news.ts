import { ipcMain } from 'electron';
import type { NewsFeedCursor, NewsFeedFilter, NewsFeedItem } from '../../shared/types';
import { fetchNewsFeed } from '../db/news-feed-api';

export function setupTgNewsHandlers(): void {
  ipcMain.handle(
    'fetch-news-feed',
    async (
      _,
      filter: NewsFeedFilter,
      before?: NewsFeedCursor
    ): Promise<NewsFeedItem[]> => {
      try {
        return await fetchNewsFeed(filter, before);
      } catch (error) {
        console.error('[news-feed] IPC handler error:', error);
        throw error;
      }
    }
  );
}
