import { ReplyIcon, RotateCcwIcon } from 'lucide-react';
import React, { useState } from 'react';
import type {
  GameReview,
  GameReviewAuthor,
  GameReviewReply,
} from '@/shared/game-reviews-types';
import { t } from '@/shared/i18n/i18n';
import { useNow } from '../../hooks/useNow';
import { Button } from '../ui/Button';
import { ReviewAvatar } from './ReviewAvatar';
import { ReviewComposer } from './ReviewComposer';
import { ReviewEditButton } from './ReviewEditButton';
import { ReviewEntryHeader } from './ReviewEntryHeader';
import { ReviewImages } from './ReviewImages';
import { REVIEW_ACTION } from './reviewActionClass';
import { THREAD_LINE } from './reviewThreadLine';

interface ReviewEntryProps {
  entry: GameReview | GameReviewReply;
  isRoot: boolean;
  hasThreadLine: boolean;
  isPublicThread: boolean;
  // Off where the launcher cannot write yet, so no reply or edit is offered that can only fail
  canWrite: boolean;
  isBug: boolean;
  replyTo: GameReviewAuthor | null;
  images: string[];
  onReply: () => void;
  onEdit: (text: string, onShown: () => void) => Promise<void>;
  onResend: () => void;
  children?: React.ReactNode;
}

const EDIT_WINDOW_MS = 15 * 60_000;

export const ReviewEntry: React.FC<ReviewEntryProps> = ({
  entry,
  isRoot,
  hasThreadLine,
  isPublicThread,
  canWrite,
  isBug,
  replyTo,
  images,
  onReply,
  onEdit,
  onResend,
  children,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const text = entry.pendingText ?? entry.text;
  const isChecking = entry.isChecking === true;
  const failure = entry.failure ?? null;
  // A nickname cannot come from a plain resend
  const canResend = failure?.kind === 'retry';
  const isOwnPlayerEntry = entry.author.isMine && entry.author.role === 'player';
  const editDeadline = new Date(entry.createdAt).getTime() + EDIT_WINDOW_MS;
  const editableUntil = canWrite && isOwnPlayerEntry ? editDeadline : 0;
  const now = useNow(10_000, editableUntil);
  const canEdit = now < editableUntil;
  const canReply = canWrite && (entry.moderation === 'published' || isChecking);

  return (
    <article id={`review-${entry.id}`} className="relative flex gap-4 min-w-0">
      {hasThreadLine && (
        <span
          aria-hidden
          className={`${THREAD_LINE} bottom-0 ${isRoot ? 'left-5 top-13' : 'left-3.5 top-10'}`}
        />
      )}
      <ReviewAvatar author={entry.author} size={isRoot ? 40 : 28} />
      <div className="flex flex-col gap-1.5 flex-1 min-w-0">
        <ReviewEntryHeader
          author={entry.author}
          createdAt={entry.createdAt}
          isEdited={entry.editedAt !== null}
          replyTo={replyTo}
          isBug={isBug}
          isPrivate={isRoot && !isPublicThread}
          isChecking={isChecking}
          isFailed={failure !== null}
          isOnModeration={
            isPublicThread &&
            (entry.moderation === 'pending' || entry.pendingText !== null)
          }
          moderationHint={t(
            entry.pendingText === null
              ? 'gameReviews.hint.moderation'
              : 'gameReviews.hint.moderationEdit'
          )}
        />
        {isEditing ? (
          <ReviewComposer
            initialText={text}
            submitLabel={t('gameReviews.save')}
            captchaAction="edit"
            isPublic={isPublicThread}
            expiresAt={editDeadline}
            onSubmit={(text) => onEdit(text, () => setIsEditing(false))}
            onClose={() => setIsEditing(false)}
          />
        ) : (
          <p className="text-sm text-text-main whitespace-pre-line wrap-break-word">
            {text}
          </p>
        )}
        <ReviewImages images={images} />
        {!isEditing && (failure ? canResend : canReply || canEdit) && (
          // Shown but disabled while the check runs, so its answer does not push the thread down
          <div className="flex items-center gap-1 -ml-2">
            {failure ? (
              <Button
                variant="ghost"
                className={REVIEW_ACTION}
                icon={<RotateCcwIcon size={14} />}
                onClick={onResend}
                data-gamepad-action
              >
                {t('gameReviews.resend')}
              </Button>
            ) : (
              <>
                {canReply && (
                  <Button
                    variant="ghost"
                    className={REVIEW_ACTION}
                    icon={<ReplyIcon size={14} />}
                    disabled={isChecking}
                    onClick={onReply}
                    data-gamepad-action
                  >
                    {t('gameReviews.reply')}
                  </Button>
                )}
                {canEdit && (
                  <ReviewEditButton
                    minutesLeft={Math.ceil((editDeadline - now) / 60_000)}
                    disabled={isChecking}
                    onClick={() => setIsEditing(true)}
                  />
                )}
              </>
            )}
          </div>
        )}
        {/* Cancels the column gap, so a composer animating in or out does not jump by it */}
        <div className="-mt-1.5">{children}</div>
      </div>
    </article>
  );
};
