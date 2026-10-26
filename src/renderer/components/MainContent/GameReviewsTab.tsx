import { RotateCcw } from 'lucide';
import { FileEditIcon, InfoIcon } from 'lucide-react';
import React, { useCallback, useState } from 'react';
import { t } from '@/shared/i18n/i18n';
import { useActionPhase } from '../../hooks/useActionPhase';
import { useInfiniteScrollSentinel } from '../../hooks/useInfiniteScrollSentinel';
import { useGameReviewActions } from '../../queries/useGameReviewActions';
import { useGameReviews } from '../../queries/useGameReviews';
import { AppActionIcon } from '../ui/AppActionIcon';
import { Button } from '../ui/Button';
import { Loader } from '../ui/Loader';
import { ReviewThread } from './ReviewThread';

interface GameReviewsTabProps {
  gameId: string;
  canLeaveFeedback: boolean;
  onLeaveFeedback: () => void;
}

export const GameReviewsTab: React.FC<GameReviewsTabProps> = ({
  gameId,
  canLeaveFeedback,
  onLeaveFeedback,
}) => {
  const {
    data,
    isPending,
    isError,
    isFetching,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
    refetch,
  } = useGameReviews(gameId);
  const actions = useGameReviewActions(gameId);
  const handleResend = useCallback(
    (entryId: string) => void actions.resend(entryId),
    [actions]
  );
  const reviews = data?.pages.flatMap((page) => page.items) ?? [];
  const total = data?.pages[0]?.total;
  // A retry resets the query to pending, so the phase keeps the focused button mounted until it settles
  const retry = useActionPhase();
  const handleRetry = () => {
    if (!retry.isPending) {
      void retry.run(() => refetch(), { isSuccess: (result) => !result.isError });
    }
  };
  // An optimistic patch clears the query's error, so the failed page is remembered here
  const [isLoadMoreFailed, setIsLoadMoreFailed] = useState(false);
  const loadNextPage = useCallback(async () => {
    const result = await fetchNextPage();
    setIsLoadMoreFailed(result.isFetchNextPageError);
    return result;
  }, [fetchNextPage]);
  const loadMore = useActionPhase();
  const handleLoadMore = () => {
    if (!loadMore.isPending) {
      void loadMore.run(loadNextPage, {
        isSuccess: (result) => !result.isFetchNextPageError,
      });
    }
  };
  const showLoadMoreError = loadMore.isBusy || (isLoadMoreFailed && !isFetchingNextPage);
  const loadFromSentinel = useCallback(() => void loadNextPage(), [loadNextPage]);
  // A failed page stays intersecting, so the sentinel waits for the manual retry instead of looping
  const attachSentinel = useInfiniteScrollSentinel({
    hasNextPage: hasNextPage && !showLoadMoreError,
    isFetchingNextPage,
    fetchNextPage: loadFromSentinel,
  });

  return (
    <section className="glass-card-no-motion flex flex-col gap-5 min-w-0 min-h-[60vh] h-max">
      <div className="flex items-start justify-between gap-4 pb-4 border-b border-border">
        <div className="flex flex-col gap-3">
          <h3 className="text-lg font-head font-semibold text-text-main">
            {t('gameReviews.title')}
          </h3>
          <p className="min-h-[18px] text-sm text-text-muted">
            {total !== undefined && t('gameReviews.count', { count: total })}
          </p>
        </div>
        {canLeaveFeedback && (
          <Button
            variant="secondary"
            icon={<FileEditIcon size={20} />}
            onClick={onLeaveFeedback}
            data-gamepad-action
          >
            {t('gameReviews.leave')}
          </Button>
        )}
      </div>

      {!canLeaveFeedback && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-lg border border-color-main/30 bg-color-main/10 text-sm text-text-main">
          <InfoIcon size={18} className="shrink-0 text-color-main" />
          {t('gameReviews.installRequired')}
        </div>
      )}

      <div className="flex-1">
        {retry.isBusy || (isError && !data && !isFetching) ? (
          <div className="flex flex-col items-center gap-4 py-12">
            <p className="text-text-muted">{t('gameReviews.loadFailed')}</p>
            <Button
              variant="secondary"
              icon={<AppActionIcon phase={retry.phase} icon={RotateCcw} size={20} />}
              onClick={handleRetry}
              aria-busy={retry.isPending}
              data-gamepad-action
            >
              {t('common.tryAgain')}
            </Button>
          </div>
        ) : isPending || !data ? (
          <div className="flex justify-center py-12">
            <Loader size="md" />
          </div>
        ) : reviews.length === 0 ? (
          <p className="text-sm text-text-muted">{t('gameReviews.empty')}</p>
        ) : (
          <div className="flex flex-col divide-y divide-white/5">
            {reviews.map((review) => (
              <div key={review.id} className="py-5 first:pt-0 last:pb-0">
                <ReviewThread
                  review={review}
                  onReply={actions.sendReply}
                  onEdit={actions.edit}
                  onResend={handleResend}
                />
              </div>
            ))}
          </div>
        )}
        {hasNextPage && !showLoadMoreError && (
          <div ref={attachSentinel} className="h-1" aria-hidden />
        )}
        {isFetchingNextPage && !loadMore.isBusy && (
          <div className="flex justify-center py-6">
            <Loader size="sm" />
          </div>
        )}
        {showLoadMoreError && (
          <div className="flex flex-col items-center gap-3 py-6">
            <p className="text-sm text-text-muted">{t('gameReviews.loadMoreFailed')}</p>
            <Button
              variant="secondary"
              icon={<AppActionIcon phase={loadMore.phase} icon={RotateCcw} size={20} />}
              onClick={handleLoadMore}
              aria-busy={loadMore.isPending}
              data-gamepad-action
            >
              {t('common.tryAgain')}
            </Button>
          </div>
        )}
      </div>
    </section>
  );
};
