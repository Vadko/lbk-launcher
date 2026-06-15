import { AnimatePresence, motion } from 'framer-motion';
import React, { useState } from 'react';
import { useNewsFeed } from '@/renderer/queries/useNewsFeed';
import type { NewsFeedFilter } from '@/shared/types';
import { useInfiniteScrollSentinel } from '../../hooks/useInfiniteScrollSentinel';
import { trackEvent } from '../../utils/analytics';
import { Button } from '../ui/Button';
import { Loader } from '../ui/Loader';

const feedTabs: { label: string; filter: NewsFeedFilter }[] = [
  { label: 'Ігри по знижці', filter: 'sales' },
  { label: 'Ігри за 80', filter: 'games-80' },
  { label: 'Новини', filter: 'news' },
];

const formatDate = (date?: string) => {
  if (!date) return null;

  const parsedDate = new Date(date);
  if (Number.isNaN(parsedDate.getTime())) return null;

  return new Intl.DateTimeFormat('uk-UA', {
    day: 'numeric',
    month: 'long',
  }).format(parsedDate);
};

export const NewsFeedSection: React.FC = () => {
  const [activeFilter, setActiveFilter] = useState<NewsFeedFilter>('sales');
  const {
    data: feedItems = [],
    isError,
    isLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useNewsFeed(activeFilter);

  const attachSentinel = useInfiniteScrollSentinel({
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  });

  const openInTelegram = async (url: string) => {
    // Витягуємо назву каналу та ID поста за допомогою регулярного виразу
    // Приклад URL: https://t.me/LBK_news/1234
    const match = url.match(/t\.me\/([\w_]+)\/(\d+)/);

    if (match) {
      const [_, domain, postId] = match;
      const tgLink = `tg://resolve?domain=${domain}&post=${postId}`;
      const result = await window.electronAPI.openExternal(tgLink);

      if (!result.success) {
        window.electronAPI.openExternal(url);
      }
    } else {
      window.electronAPI.openExternal(url);
    }
    trackEvent('Open news', { url });
  };

  return (
    <section>
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-4xl font-head font-semibold text-text-main">Новини</h2>
        <div className="glass-card-no-motion !p-2 flex gap-2">
          {feedTabs.map((tab) => (
            <button
              key={tab.filter}
              type="button"
              onClick={() => setActiveFilter(tab.filter)}
              data-gamepad-action
              className={`px-6 py-2 rounded-xl font-medium transition-all ${
                activeFilter === tab.filter
                  ? 'bg-gradient-to-r from-color-accent to-color-main text-text-dark'
                  : 'bg-surface-elevated text-text-muted hover:text-text-main hover:bg-surface-elevated/80'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-8 align-start">
        <AnimatePresence mode="wait" initial={false}>
          {isLoading ? (
            <motion.div
              key="news-loader"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3, ease: 'easeInOut' }}
              className="col-span-2 flex items-center justify-center py-12"
            >
              <Loader size="md" />
            </motion.div>
          ) : isError || feedItems.length === 0 ? (
            <motion.div
              key="news-empty"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3, ease: 'easeInOut' }}
              className="col-span-2 text-center text-text-muted py-8"
            >
              <p>Новин не знайдено</p>
            </motion.div>
          ) : (
            <React.Fragment>
              {feedItems.map((item, index) => {
                const publishedAt = formatDate(item.publishedAt);

                return (
                  <motion.article
                    key={item.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{
                      duration: 0.4,
                      delay: Math.min(index * 0.05, 0.2),
                      ease: [0.25, 0.46, 0.45, 0.94],
                    }}
                    className="glass-card-no-motion !p-5 min-h-[172px] flex flex-col gap-4"
                  >
                    <div>
                      {publishedAt && (
                        <p className="text-sm text-text-muted mb-2">{publishedAt}</p>
                      )}
                      <h3 className="text-xl font-head font-semibold text-text-main line-clamp-2">
                        {item.title}
                      </h3>
                    </div>

                    {item.content && (
                      <p
                        className="text-sm leading-6 text-text-muted line-clamp-6"
                        dangerouslySetInnerHTML={{ __html: item.content }}
                      />
                    )}

                    <Button
                      data-gamepad-action
                      aria-label="Відкрити новину"
                      title="Відкрити новину"
                      variant="secondary"
                      onClick={() => openInTelegram(item.url)}
                      className="w-fit !px-3 !py-2 text-sm"
                    >
                      Обговорити в Telegram
                    </Button>
                  </motion.article>
                );
              })}
              {hasNextPage && (
                <div ref={attachSentinel} className="col-span-2 h-1" aria-hidden />
              )}
              {isFetchingNextPage && (
                <div className="col-span-2 flex items-center justify-center py-6">
                  <Loader size="sm" />
                </div>
              )}
            </React.Fragment>
          )}
        </AnimatePresence>
      </div>
    </section>
  );
};
