import { FileEdit, Info } from 'lucide-react';
import React, { useState } from 'react';
import type { GameReview, GameReviewReply } from '@/shared/types';
import { useGameReviews } from '../../queries/useGameReviews';
import { Button } from '../ui/Button';
import { Loader } from '../ui/Loader';
import { ReviewsPagination } from './ReviewsPagination';

interface GameReviewsTabProps {
  gameId: string;
  canLeaveFeedback: boolean;
  onLeaveFeedback: () => void;
}

const TIME_FORMAT: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit' };

function formatReviewDate(iso: string): string {
  const date = new Date(iso);
  const time = date.toLocaleTimeString('uk-UA', TIME_FORMAT);
  const dayStart = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const daysAgo = Math.round(
    (dayStart(new Date()).getTime() - dayStart(date).getTime()) / 86_400_000
  );

  if (daysAgo === 0) {
    return `Сьогодні, ${time}`;
  }
  if (daysAgo === 1) {
    return `Вчора, ${time}`;
  }
  const day = date
    .toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' })
    .replace('.', '');
  return `${day}, ${time}`;
}

function formatCommentsCount(count: number): string {
  const lastTwo = count % 100;
  const last = count % 10;
  if (lastTwo >= 11 && lastTwo <= 14) {
    return `${count} коментарів`;
  }
  if (last === 1) {
    return `${count} коментар`;
  }
  if (last >= 2 && last <= 4) {
    return `${count} коментарі`;
  }
  return `${count} коментарів`;
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
        Відповідь автора
      </span>
      <span className="text-sm text-text-muted">{formatReviewDate(reply.createdAt)}</span>
    </div>
    <p className="text-sm text-text-main break-words">{reply.text}</p>
  </div>
);

const ReviewItem: React.FC<{ review: GameReview }> = ({ review }) => (
  <div className="flex flex-col gap-2.5 pb-3 border-b border-white/[0.03]">
    <p className="text-sm text-text-muted">{formatReviewDate(review.createdAt)}</p>
    <p className="text-sm text-text-main break-words">{review.text}</p>
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
  const { data, isPending, isError, isPlaceholderData } = useGameReviews(gameId, page);
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <section className="glass-card-no-motion flex flex-col gap-5 min-w-0 min-h-[60vh] h-max">
      <div className="flex items-start justify-between gap-4 pb-4 border-b border-border">
        <div className="flex flex-col gap-3">
          <h3 className="text-lg font-head font-semibold text-text-main">
            Відгуки спільноти
          </h3>
          <p className="min-h-[18px] text-sm text-text-muted">
            {data && formatCommentsCount(data.total)}
          </p>
        </div>
        {canLeaveFeedback && (
          <Button
            variant="secondary"
            icon={<FileEdit size={20} />}
            onClick={onLeaveFeedback}
            data-gamepad-action
          >
            Лишити відгук
          </Button>
        )}
      </div>

      {!canLeaveFeedback && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-lg border border-color-main/30 bg-color-main/10 text-sm text-text-main">
          <Info size={18} className="shrink-0 text-color-main" />
          Залишити відгук можна лише після встановлення перекладу.
        </div>
      )}

      <div className="flex-1">
        {isPending ? (
          <div className="flex justify-center py-12">
            <Loader size="md" />
          </div>
        ) : isError || !data ? (
          <p className="text-center text-text-muted py-12">
            Не вдалося завантажити відгуки. Спробуйте пізніше.
          </p>
        ) : data.items.length === 0 ? (
          <p className="text-sm text-text-muted">Поки що немає відгуків.</p>
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
        <ReviewsPagination page={page} totalPages={totalPages} onChange={setPage} />
      )}
    </section>
  );
};
