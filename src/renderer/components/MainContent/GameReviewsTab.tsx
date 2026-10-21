import { RotateCcw } from 'lucide';
import { FileEditIcon, InfoIcon } from 'lucide-react';
import React, { useState } from 'react';
import type {
  GameReview,
  GameReviewReply,
  GameReviewsPage,
} from '@/shared/game-reviews-types';
import { t } from '@/shared/i18n/i18n';
import { useActionPhase } from '../../hooks/useActionPhase';
import { useGameReviews } from '../../queries/useGameReviews';
import { AppActionIcon } from '../ui/AppActionIcon';
import { Button } from '../ui/Button';
import { Loader } from '../ui/Loader';
import { ReviewImages } from './ReviewImages';
import { ReviewsPagination } from './ReviewsPagination';

interface GameReviewsTabProps {
  gameId: string;
  canLeaveFeedback: boolean;
  onLeaveFeedback: () => void;
}

const TIME_FORMAT: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit' };

function formatReviewDate(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const time = date.toLocaleTimeString('uk-UA', TIME_FORMAT);
  const dayStart = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const daysAgo = Math.round(
    (dayStart(now).getTime() - dayStart(date).getTime()) / 86_400_000
  );

  if (daysAgo === 0) {
    return t('gameReviews.today', { time });
  }
  if (daysAgo === 1) {
    return t('gameReviews.yesterday', { time });
  }
  const day = date
    .toLocaleDateString('uk-UA', {
      day: 'numeric',
      month: 'short',
      ...(date.getFullYear() !== now.getFullYear() && { year: 'numeric' }),
    })
    .replace('.', '');
  return `${day}, ${time}`;
}

const AuthorReply: React.FC<{ reply: GameReviewReply; isLast: boolean }> = ({
  reply,
  isLast,
}) => (
  <div
    className={`relative flex flex-col gap-2 pt-3 pl-6 ${!isLast && 'border-l border-color-main'}`}
  >
    <span className="absolute left-0 top-0 h-[22px] w-5 border-l border-b border-color-main rounded-bl-xl" />
    <div className="flex items-center gap-2">
      <span className="px-2 py-0.5 rounded-md bg-color-main/15 text-xs font-semibold text-color-main">
        {t('gameReviews.authorReply')}
      </span>
      <span className="text-sm text-text-muted">{formatReviewDate(reply.createdAt)}</span>
    </div>
    <p className="text-sm text-text-main wrap-break-word">{reply.text}</p>
  </div>
);

const ReviewItem: React.FC<{ review: GameReview }> = ({ review }) => (
  <div className="flex flex-col gap-2.5 pb-3 border-b border-white/[0.03]">
    <p className="text-sm text-text-muted">{formatReviewDate(review.createdAt)}</p>
    <p className="text-sm text-text-main wrap-break-word">{review.text}</p>
    <ReviewImages images={review.images} />
    {review.replies.length > 0 && (
      <div className="flex flex-col -mt-2.5 ml-3">
        {review.replies.map((reply, i) => (
          <AuthorReply
            key={reply.id}
            reply={reply}
            isLast={i === review.replies.length - 1}
          />
        ))}
      </div>
    )}
  </div>
);

export const GameReviewsTab: React.FC<GameReviewsTabProps> = ({
  gameId,
  canLeaveFeedback,
  onLeaveFeedback,
}) => {
  const [page, setPage] = useState(1);
  const { data, isPending, isError, isFetching, isPlaceholderData, refetch } =
    useGameReviews(gameId, page);
  // A failed page has no data; the last known count keeps the pagination there to leave it
  const [summary, setSummary] = useState<Pick<GameReviewsPage, 'total' | 'pageSize'>>();
  if (data && (data.total !== summary?.total || data.pageSize !== summary?.pageSize)) {
    setSummary({ total: data.total, pageSize: data.pageSize });
  }
  const totalPages = summary
    ? Math.max(1, Math.ceil(summary.total / summary.pageSize))
    : 1;
  // A retry resets the query to pending, so the phase keeps the focused button mounted until it settles
  const retry = useActionPhase();
  const handleRetry = () => {
    if (!retry.isPending) {
      void retry.run(() => refetch(), { isSuccess: (result) => !result.isError });
    }
  };
  const handlePageChange = (next: number) => {
    retry.reset();
    setPage(next);
  };

  return (
    <section className="glass-card-no-motion flex flex-col gap-5 min-w-0 min-h-[60vh] h-max">
      <div className="flex items-start justify-between gap-4 pb-4 border-b border-border">
        <div className="flex flex-col gap-3">
          <h3 className="text-lg font-head font-semibold text-text-main">
            {t('gameReviews.title')}
          </h3>
          <p className="min-h-[18px] text-sm text-text-muted">
            {summary && t('gameReviews.count', { count: summary.total })}
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
        {retry.isBusy || (isError && !isFetching) ? (
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
        ) : data.items.length === 0 ? (
          <p className="text-sm text-text-muted">{t('gameReviews.empty')}</p>
        ) : (
          <div
            className={`flex flex-col gap-4 transition-opacity ${isPlaceholderData ? 'opacity-60' : ''}`}
          >
            {data.items.map((review) => (
              <ReviewItem key={review.id} review={review} />
            ))}
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <ReviewsPagination
          page={page}
          totalPages={totalPages}
          onChange={handlePageChange}
        />
      )}
    </section>
  );
};
