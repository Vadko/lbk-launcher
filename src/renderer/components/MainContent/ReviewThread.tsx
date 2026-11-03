import { AnimatePresence } from 'framer-motion';
import React, { useState } from 'react';
import { t } from '@/shared/i18n/i18n';
import { useFocusEntry } from '../../hooks/useFocusEntry';
import type { ReviewThreadView } from '../../queries/reviewViewTypes';
import { buildReplyTree, type ReplyNode } from '../../utils/replyTree';
import { ReviewComposer } from './ReviewComposer';
import { ReviewEntry } from './ReviewEntry';
import { ReviewRemovedEntry } from './ReviewRemovedEntry';
import { ReviewReplyBranch } from './ReviewReplyBranch';
import { ReviewReveal } from './ReviewReveal';

interface ReviewThreadProps {
  review: ReviewThreadView;
  onReply: (
    review: ReviewThreadView,
    text: string,
    parentId: string | null
  ) => Promise<boolean>;
  onEdit: (review: ReviewThreadView, entryId: string, text: string) => void;
  onResend: (entryId: string) => void;
  onDiscard: (entryId: string) => void;
  // The deep-linked entry of this thread, until it has been scrolled to
  focusEntryId: string | null;
  onFocused: () => void;
}

// Deeper answers stay on the last level and name whom they answer, so the text keeps its width
const MAX_DEPTH = 3;

// A reply changes one thread; memo keeps the others from re-rendering in the animation's first frame
export const ReviewThread: React.FC<ReviewThreadProps> = React.memo(
  ({ review, onReply, onEdit, onResend, onDiscard, focusEntryId, onFocused }) => {
    const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());
    const [replyingTo, setReplyingTo] = useState<string | null>(null);
    const tree = buildReplyTree(review.id, review.replies, MAX_DEPTH);
    useFocusEntry({
      rootId: review.id,
      tree,
      entryId: focusEntryId,
      expanded,
      expand: (branchIds) =>
        setExpanded((current) => new Set([...current, ...branchIds])),
      onFocused,
    });

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
                captchaAction="reply"
                isPublic={review.isPublic}
                onSubmit={async (text) => {
                  const sent = await onReply(
                    review,
                    text,
                    entryId === review.id ? null : entryId
                  );
                  if (sent) {
                    setReplyingTo(null);
                    setExpanded((current) => new Set(current).add(landingBranchId));
                  }
                  return sent;
                }}
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
          isBug={false}
          replyTo={replyTo}
          images={[]}
          onReply={() => setReplyingTo(reply.id)}
          onEdit={(text) => onEdit(review, reply.id, text)}
          onResend={() => onResend(reply.id)}
          onDiscard={() => onDiscard(reply.id)}
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
          isBug={review.type === 'error'}
          replyTo={null}
          images={review.screenshots}
          onReply={() => setReplyingTo(review.id)}
          onEdit={(text) => onEdit(review, review.id, text)}
          onResend={() => onResend(review.id)}
          onDiscard={() => onDiscard(review.id)}
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
