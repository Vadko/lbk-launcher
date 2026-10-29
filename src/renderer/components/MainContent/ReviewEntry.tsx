import { ReplyIcon, RotateCcwIcon, XIcon } from 'lucide-react';
import React, { useState } from 'react';
import type { GameReviewAuthor } from '@/shared/game-reviews-types';
import { t } from '@/shared/i18n/i18n';
import { useNow } from '../../hooks/useNow';
import type { ReviewReplyView, ReviewThreadView } from '../../queries/reviewViewTypes';
import { editDeadline } from '../../utils/editDeadline';
import { Button } from '../ui/Button';
import { ReviewAvatar } from './ReviewAvatar';
import { ReviewComposer } from './ReviewComposer';
import { ReviewEditButton } from './ReviewEditButton';
import { ReviewEntryHeader } from './ReviewEntryHeader';
import { ReviewImages } from './ReviewImages';
import { REVIEW_ACTION } from './reviewActionClass';
import { THREAD_LINE } from './reviewThreadLine';

interface ReviewEntryProps {
  entry: ReviewThreadView | ReviewReplyView;
  isRoot: boolean;
  hasThreadLine: boolean;
  isPublicThread: boolean;
  isBug: boolean;
  replyTo: GameReviewAuthor | null;
  images: string[];
  onReply: () => void;
  onEdit: (text: string, onShown: () => void) => Promise<boolean>;
  onResend: () => void;
  onDiscard: () => void;
  children?: React.ReactNode;
}

export const ReviewEntry: React.FC<ReviewEntryProps> = ({
  entry,
  isRoot,
  hasThreadLine,
  isPublicThread,
  isBug,
  replyTo,
  images,
  onReply,
  onEdit,
  onResend,
  onDiscard,
  children,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const text = entry.pendingText ?? entry.text;
  const isChecking = entry.isChecking === true;
  const failure = entry.failure ?? null;
  const isOwnPlayerEntry = entry.author.isMine && entry.author.role === 'player';
  const deadline = editDeadline(entry.createdAt);
  const editableUntil = isOwnPlayerEntry ? deadline : 0;
  const now = useNow(10_000, editableUntil);
  const canEdit = now < editableUntil;
  // A new reply has no deadline, while the server refuses a failed edit once its window closed
  const canResend = entry.write !== 'edit' || canEdit;
  const canReply = entry.moderation === 'published' || isChecking;

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
            expiresAt={deadline}
            onSubmit={(text) => onEdit(text, () => setIsEditing(false))}
            onClose={() => setIsEditing(false)}
          />
        ) : (
          <p className="text-sm text-text-main whitespace-pre-line wrap-break-word">
            {text}
          </p>
        )}
        <ReviewImages images={images} />
        {!isEditing && (failure !== null || canReply || canEdit) && (
          // Shown but disabled while the check runs, so its answer does not push the thread down
          <div className="flex items-center gap-1 -ml-2">
            {failure ? (
              <>
                {canResend && (
                  <Button
                    variant="ghost"
                    className={REVIEW_ACTION}
                    icon={<RotateCcwIcon size={14} />}
                    onClick={onResend}
                    data-gamepad-action
                  >
                    {t('gameReviews.resend')}
                  </Button>
                )}
                <Button
                  variant="ghost"
                  className={REVIEW_ACTION}
                  icon={<XIcon size={14} />}
                  onClick={onDiscard}
                  data-gamepad-action
                >
                  {t('common.cancel')}
                </Button>
              </>
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
                    minutesLeft={Math.ceil((deadline - now) / 60_000)}
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
