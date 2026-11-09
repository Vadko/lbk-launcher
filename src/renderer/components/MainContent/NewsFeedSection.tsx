import { AnimatePresence, motion } from 'framer-motion';
import { Fragment, useState } from 'react';
import { useNewsFeed } from '@/renderer/queries/useNewsFeed';
import { t } from '@/shared/i18n/i18n';
import type { NewsFeedFilter } from '@/shared/types';
import { useInfiniteScrollSentinel } from '../../hooks/useInfiniteScrollSentinel';
import { trackEvent } from '../../utils/analytics';
import { Button } from '../ui/Button';
import { Loader } from '../ui/Loader';
import { SlidingTabs } from '../ui/SlidingTabs';

const FEED_FILTERS: readonly NewsFeedFilter[] = ['sales', 'games-80', 'news'];

const formatDate = (date?: string) => {
  if (!date) {
    return null;
  }

  const parsedDate = new Date(date);
  if (Number.isNaN(parsedDate.getTime())) {
    return null;
  }

  return new Intl.DateTimeFormat('uk-UA', {
    day: 'numeric',
    month: 'long',
  }).format(parsedDate);
};

export function NewsFeedSection() {
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
    isBusy: isFetchingNextPage,
    fetchNextPage,
  });

  const openInTelegram = (url: string) => {
    void window.electronAPI.openAppLink('telegram', url);
    trackEvent('Open news', { url });
  };

  return (
    <section>
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-4xl font-head font-semibold text-text-main">
          {t('newsFeed.title')}
        </h2>
        <SlidingTabs
          tabs={FEED_FILTERS}
          active={activeFilter}
          label={(filter) => t(`newsFeed.tab.${filter}`)}
          onChange={setActiveFilter}
        />
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
              <p>{t('newsFeed.empty')}</p>
            </motion.div>
          ) : (
            <Fragment>
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
                    className="glass-card-no-motion p-5! min-h-[172px] flex flex-col gap-4"
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
                      aria-label={t('newsFeed.open')}
                      title={t('newsFeed.open')}
                      variant="secondary"
                      onClick={() => openInTelegram(item.url)}
                      className="w-fit px-3! py-2! text-sm"
                    >
                      {t('newsFeed.discuss')}
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
            </Fragment>
          )}
        </AnimatePresence>
      </div>
    </section>
  );
}
