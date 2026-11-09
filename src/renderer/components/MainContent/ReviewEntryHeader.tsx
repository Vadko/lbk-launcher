import { BugIcon, CornerDownRightIcon, LockIcon } from 'lucide-react';
import type { GameReviewAuthor } from '@/shared/game-reviews-types';
import { t } from '@/shared/i18n/i18n';
import { reviewAuthorName } from '../../utils/reviewAuthorName';
import { Tooltip } from '../ui/Tooltip';
import { ReviewModerationBadge } from './ReviewModerationBadge';
import { PILL, TONE } from './reviewPill';

interface ReviewEntryHeaderProps {
  author: GameReviewAuthor;
  createdAt: string;
  isEdited: boolean;
  replyTo: GameReviewAuthor | null;
  isBug: boolean;
  isPrivate: boolean;
  isChecking: boolean;
  isFailed: boolean;
  isOnModeration: boolean;
  // A refused edit: the badge leaves instead of confirming
  isRolledBack: boolean;
  badgeHint: string;
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

const authorName = ({ role, name }: GameReviewAuthor): string =>
  reviewAuthorName(role, name) ?? t('gameReviews.you');

export function ReviewEntryHeader({
  author,
  createdAt,
  isEdited,
  replyTo,
  isBug,
  isPrivate,
  isChecking,
  isFailed,
  isOnModeration,
  isRolledBack,
  badgeHint,
}: ReviewEntryHeaderProps) {
  return (
    <div className="flex items-center gap-2 min-w-0">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 min-w-0">
        <span
          className={`text-sm font-semibold ${author.role === 'player' ? 'text-text-main' : 'text-color-main'}`}
        >
          {authorName(author)}
        </span>
        {author.isMine && author.name && (
          <span className={`${PILL} ${TONE.neutral}`}>{t('gameReviews.you')}</span>
        )}
        {author.role === 'author' && author.name && (
          <span className={`${PILL} ${TONE.main}`}>
            {t('gameReviews.translationAuthor')}
          </span>
        )}
        {replyTo && (
          <span className="inline-flex items-center gap-1 text-sm text-text-muted">
            <CornerDownRightIcon size={14} className="shrink-0" />
            {authorName(replyTo)}
          </span>
        )}
        <span className="text-xs text-text-muted">
          {formatReviewDate(createdAt)}
          {isEdited && ` · ${t('gameReviews.edited')}`}
        </span>
      </div>
      <div className="flex items-center gap-2 ml-auto shrink-0">
        {isBug && (
          <span className={`${PILL} ${TONE.accent}`}>
            <BugIcon size={12} className="shrink-0" />
            {t('gameReviews.bug')}
          </span>
        )}
        {isPrivate && (
          <Tooltip content={t('gameReviews.hint.private')} align="left">
            <span className={`${PILL} ${TONE.muted}`}>
              <LockIcon size={12} className="shrink-0" />
              {t('gameReviews.private')}
            </span>
          </Tooltip>
        )}
        <ReviewModerationBadge
          isChecking={isChecking}
          settled={isFailed ? 'failed' : isOnModeration ? 'moderation' : 'confirmed'}
          isRolledBack={isRolledBack}
          hint={badgeHint}
        />
      </div>
    </div>
  );
}
