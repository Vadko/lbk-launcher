import { AnimatePresence, motion } from 'framer-motion';
import { ExternalLink } from 'lucide-react';
import React, { useState } from 'react';
import { useNewsFeed } from '@/renderer/queries/useNewsFeed';
import type { NewsFeedFilter } from '@/shared/types';
import { Loader } from '../ui/Loader';

const feedTabs: { label: string; filter: NewsFeedFilter }[] = [
  { label: 'Ігри за 80', filter: 'games-80' },
  { label: 'Новини', filter: 'news' },
  { label: 'Реклама', filter: 'ads' },
  { label: 'Пошук людей', filter: 'people-search' },
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
  const [activeFilter, setActiveFilter] = useState<NewsFeedFilter>('games-80');
  const { data: feedItems = [], isError, isLoading } = useNewsFeed(activeFilter);

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
  };

  return (
    <section className="text-left w-full max-w-[1317px]">
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-4xl font-head font-semibold text-text-main">Новини</h2>
        <div className="glass-card-no-motion flex gap-2">
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

      <div className="grid grid-cols-3 gap-8">
        <AnimatePresence mode="wait" initial={false}>
          {isLoading ? (
            <motion.div
              key="news-loader"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3, ease: 'easeInOut' }}
              className="col-span-3 flex items-center justify-center py-12"
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
              className="col-span-3 text-center text-text-muted py-8"
            >
              <p>Новин не знайдено</p>
            </motion.div>
          ) : (
            <React.Fragment key={`news-feed-${activeFilter}`}>
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
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        {publishedAt && (
                          <p className="text-sm text-text-muted mb-2">{publishedAt}</p>
                        )}
                        <h3 className="text-xl font-head font-semibold text-text-main line-clamp-2">
                          {item.title}
                        </h3>
                      </div>
                      <button
                        type="button"
                        data-gamepad-action
                        aria-label="Відкрити новину"
                        title="Відкрити новину"
                        onClick={() => openInTelegram(item.url)}
                        className="shrink-0 size-10 rounded-full bg-surface-elevated text-text-main flex items-center justify-center hover:bg-white/10 transition-colors focus-visible:outline focus-visible:outline-1 focus-visible:outline-white"
                      >
                        <ExternalLink size={18} />
                      </button>
                    </div>

                    {item.content && (
                      <p
                        className="text-sm leading-6 text-text-muted line-clamp-4"
                        dangerouslySetInnerHTML={{ __html: item.content }}
                      />
                    )}
                  </motion.article>
                );
              })}
            </React.Fragment>
          )}
        </AnimatePresence>
      </div>
    </section>
  );
};
