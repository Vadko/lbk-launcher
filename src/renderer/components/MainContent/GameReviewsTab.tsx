import { A } from '@mobily/ts-belt';
import { usePrefetchInfiniteQuery } from '@tanstack/react-query';
import { RotateCcw } from 'lucide';
import { InfoIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { t } from '@/shared/i18n/i18n';
import { useActionPhase } from '../../hooks/useActionPhase';
import { useHasReviewNotices } from '../../hooks/useHasReviewNotices';
import { useInfiniteScrollSentinel } from '../../hooks/useInfiniteScrollSentinel';
import { useReviewFocus } from '../../hooks/useReviewFocus';
import { gameReviewsQueryOptions } from '../../queries/gameReviewsQueryOptions';
import { useGameReviewActions } from '../../queries/useGameReviewActions';
import { useGameReviews } from '../../queries/useGameReviews';
import { useSubscriptionsStore } from '../../store/useSubscriptionsStore';
import type { ReviewFocus } from '../../utils/readReviewLink';
import type { ReviewCounts } from '../../utils/reviewCounts';
import { AppActionIcon } from '../ui/AppActionIcon';
import { Button } from '../ui/Button';
import { Loader } from '../ui/Loader';
import { ReviewsHeader } from './ReviewsHeader';
import { ReviewThread } from './ReviewThread';
import { type ReviewFilter, ReviewTypeFilter } from './ReviewTypeFilter';

interface GameReviewsTabProps {
  gameId: string;
  gameName: string;
  reviewCounts: ReviewCounts;
  canLeaveFeedback: boolean;
  onLeaveFeedback: () => void;
  // A deep link's entry, until the tab has shown it
  focus: ReviewFocus | null;
  onFocusHandled: () => void;
  // A link to the tab alone, waiting for the first page before the page scrolls to it
  reveal: boolean;
  onRevealed: () => void;
}

export function GameReviewsTab({
  gameId,
  gameName,
  reviewCounts,
  canLeaveFeedback,
  onLeaveFeedback,
  focus,
  onFocusHandled,
  reveal,
  onRevealed,
}: GameReviewsTabProps) {
  const [filter, setFilter] = useState<ReviewFilter>('all');
  // Both typed first pages load with the tab, so a filter switch shows a ready list
  usePrefetchInfiniteQuery(gameReviewsQueryOptions(gameId, null, 'feedback'));
  usePrefetchInfiniteQuery(gameReviewsQueryOptions(gameId, null, 'error'));
  // A review link may point at a thread of either type, so it opens the full list
  if (focus && filter !== 'all') {
    setFilter('all');
  }
  const type = filter === 'all' ? null : filter;
  const { query, data, loadNextPage } = useGameReviews(gameId, focus, type);
  const hasReviewNotices = useHasReviewNotices(gameId);
  useEffect(() => {
    if (hasReviewNotices) {
      useSubscriptionsStore.getState().markGameReviewNoticesAsRead(gameId);
    }
  }, [hasReviewNotices, gameId]);
  const {
    isError,
    isFetching,
    fetchStatus,
    isRefetchError,
    isFetchNextPageError,
    hasNextPage,
    isFetchingNextPage,
    refetch,
  } = query;
  const isFirstPageSettled = !query.isPending;
  useEffect(() => {
    if (reveal && isFirstPageSettled) {
      onRevealed();
    }
  }, [reveal, isFirstPageSettled, onRevealed]);
  const actions = useGameReviewActions(gameId, gameName, data?.pages[0]?.viewer ?? null);
  // The focus thread rides on the first page and comes again once its own page loads
  const reviews = A.uniqBy(
    (data?.pages ?? []).flatMap((page) => page.items),
    (thread) => thread.id
  );
  const focused = useReviewFocus({
    focus,
    threads: reviews,
    // A refetch paused offline is not fetching, yet its pages may predate the link
    isSettled: data !== undefined && fetchStatus === 'idle',
    isRefetchError,
    onHandled: onFocusHandled,
  });
  // A retry resets the query to pending, so the phase keeps the focused button mounted until it settles
  const retry = useActionPhase();
  const handleRetry = () => {
    if (!retry.isPending) {
      void retry.run(() => refetch(), { isSuccess: (result) => !result.isError });
    }
  };
  const loadMore = useActionPhase();
  const handleLoadMore = () => {
    if (!loadMore.isPending) {
      void loadMore.run(loadNextPage, {
        isSuccess: (result) => !result.isFetchNextPageError,
      });
    }
  };
  const showLoadMoreError =
    loadMore.isBusy || (isFetchNextPageError && !isFetchingNextPage);
  const attachSentinel = useInfiniteScrollSentinel({
    hasNextPage,
    // A next page asked during a refetch joins it and adds nothing, so the sentinel looks again after
    isBusy: isFetching,
    fetchNextPage: loadNextPage,
  });

  return (
    <section className="glass-card-no-motion flex flex-col gap-5 min-w-0 min-h-[60vh] h-max">
      <ReviewsHeader
        reviewCounts={reviewCounts}
        canLeaveFeedback={canLeaveFeedback}
        onLeaveFeedback={onLeaveFeedback}
      />
      <ReviewTypeFilter value={filter} counts={reviewCounts} onChange={setFilter} />
      <div className="h-px bg-white/8" />

      {!canLeaveFeedback && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-lg border border-color-main/30 bg-color-main/10 text-sm text-text-main">
          <InfoIcon size={18} className="shrink-0 text-color-main" />
          {t('gameReviews.installRequired')}
        </div>
      )}

      {focused.notice && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-lg border border-border bg-glass text-sm text-text-muted">
          <InfoIcon size={18} className="shrink-0" />
          {t(`gameReviews.${focused.notice}`)}
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
        ) : !data ? (
          <div className="flex justify-center py-12">
            <Loader size="md" />
          </div>
        ) : reviews.length === 0 ? (
          <p className="text-sm text-text-muted">
            {t(type === 'error' ? 'gameReviews.emptyErrors' : 'gameReviews.empty')}
          </p>
        ) : (
          <div className="flex flex-col divide-y divide-white/5">
            {reviews.map((review) => (
              <div key={review.id} className="py-5 first:pt-0 last:pb-0">
                <ReviewThread
                  review={review}
                  onReply={actions.sendReply}
                  onEdit={actions.edit}
                  onResend={actions.resend}
                  onDiscard={actions.discard}
                  focusEntryId={review.id === focused.threadId ? focused.entryId : null}
                  onFocused={focused.onFocused}
                />
              </div>
            ))}
          </div>
        )}
        {/* A failed page stays intersecting, so the sentinel waits for the manual retry instead of looping */}
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
}
