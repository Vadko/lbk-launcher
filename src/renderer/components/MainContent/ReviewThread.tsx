import { AnimatePresence } from 'framer-motion';
import React, { useState } from 'react';
import type { GameReview } from '@/shared/game-reviews-types';
import { t } from '@/shared/i18n/i18n';
import { buildReplyTree, type ReplyNode } from '../../utils/replyTree';
import { ReviewComposer } from './ReviewComposer';
import { ReviewEntry } from './ReviewEntry';
import { ReviewRemovedEntry } from './ReviewRemovedEntry';
import { ReviewReplyBranch } from './ReviewReplyBranch';
import { ReviewReveal } from './ReviewReveal';

interface ReviewThreadProps {
  review: GameReview;
  onReply: (
    reviewId: string,
    text: string,
    parentId: string | null,
    onShown: () => void
  ) => Promise<void>;
  onEdit: (entryId: string, text: string, onShown: () => void) => Promise<void>;
  onResend: (entryId: string) => void;
}

// Deeper answers stay on the last level and name whom they answer, so the text keeps its width
const MAX_DEPTH = 3;

// A reply changes one thread; memo keeps the others from re-rendering in the animation's first frame
export const ReviewThread: React.FC<ReviewThreadProps> = React.memo(
  ({ review, onReply, onEdit, onResend }) => {
    const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());
    const [replyingTo, setReplyingTo] = useState<string | null>(null);
    const tree = buildReplyTree(review.id, review.replies, MAX_DEPTH);
    // A public thread takes writes only with a nickname and a captcha token, which the launcher cannot get yet
    const canWrite = !review.isPublic;

    const toggle = (id: string) =>
      setExpanded((current) => {
        const next = new Set(current);
        if (!next.delete(id)) {
          next.add(id);
        }
        return next;
      });

    // A new reply lands last in a branch that may be collapsed, so that branch opens
    const composerFor = (entryId: string, landingBranchId: string) => (
      <AnimatePresence initial={false}>
        {replyingTo === entryId && (
          <ReviewReveal key="composer">
            <div className="pt-1.5">
              <ReviewComposer
                submitLabel={t('gameReviews.send')}
                onSubmit={(text) =>
                  onReply(review.id, text, entryId === review.id ? null : entryId, () => {
                    setReplyingTo(null);
                    setExpanded((current) => new Set(current).add(landingBranchId));
                  })
                }
                onClose={() => setReplyingTo(null)}
              />
            </div>
          </ReviewReveal>
        )}
      </AnimatePresence>
    );

    const renderReply = ({ reply, children, depth, branchId, replyTo }: ReplyNode) =>
      'removed' in reply ? (
        <ReviewRemovedEntry id={reply.id} />
      ) : (
        <ReviewEntry
          entry={reply}
          isRoot={false}
          hasThreadLine={children.length > 0}
          isPublicThread={review.isPublic}
          canWrite={canWrite}
          isBug={false}
          replyTo={replyTo}
          images={[]}
          onReply={() => setReplyingTo(reply.id)}
          onEdit={(text, onShown) => onEdit(reply.id, text, onShown)}
          onResend={() => onResend(reply.id)}
        >
          {composerFor(reply.id, depth < MAX_DEPTH ? reply.id : branchId)}
        </ReviewEntry>
      );

    return (
      <div className="flex flex-col">
        <ReviewEntry
          entry={review}
          isRoot
          hasThreadLine={tree.length > 0}
          isPublicThread={review.isPublic}
          canWrite={canWrite}
          isBug={review.type === 'error'}
          replyTo={null}
          images={review.screenshots}
          onReply={() => setReplyingTo(review.id)}
          onEdit={(text, onShown) => onEdit(review.id, text, onShown)}
          onResend={() => onResend(review.id)}
        >
          {composerFor(review.id, review.id)}
        </ReviewEntry>
        <ReviewReplyBranch
          parentId={review.id}
          level="review"
          nodes={tree}
          isExpanded={(id) => expanded.has(id)}
          onToggle={toggle}
          renderReply={renderReply}
        />
      </div>
    );
  }
);
