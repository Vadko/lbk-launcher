import { AnimatePresence } from 'framer-motion';
import { ChevronDownIcon, ChevronUpIcon } from 'lucide-react';
import React from 'react';
import { t } from '@/shared/i18n/i18n';
import { countReplies, type ReplyNode } from '../../utils/replyTree';
import { Button } from '../ui/Button';
import { type BranchLevel, ReviewThreadRow } from './ReviewThreadRow';

interface ReviewReplyBranchProps {
  parentId: string;
  level: BranchLevel;
  nodes: ReplyNode[];
  isExpanded: (id: string) => boolean;
  onToggle: (id: string) => void;
  renderReply: (node: ReplyNode) => React.ReactNode;
}

const VISIBLE_REPLIES = 3;

export const ReviewReplyBranch: React.FC<ReviewReplyBranchProps> = ({
  parentId,
  level,
  nodes,
  isExpanded,
  onToggle,
  renderReply,
}) => {
  const expanded = isExpanded(parentId);
  const hasToggle = nodes.length > VISIBLE_REPLIES;
  const visible = expanded ? nodes : nodes.slice(0, VISIBLE_REPLIES);

  return (
    <AnimatePresence initial={false}>
      {visible.map((node, index) => (
        <ReviewThreadRow
          key={node.reply.id}
          level={level}
          isLast={!hasToggle && index === visible.length - 1}
          isToggle={false}
        >
          {renderReply(node)}
          {/* Mounted while empty too, so the first answer to a reply animates in */}
          <ReviewReplyBranch
            parentId={node.reply.id}
            level="reply"
            nodes={node.children}
            isExpanded={isExpanded}
            onToggle={onToggle}
            renderReply={renderReply}
          />
        </ReviewThreadRow>
      ))}
      {hasToggle && (
        <ReviewThreadRow key="toggle" level={level} isLast isToggle>
          <Button
            variant="ghost"
            className="-ml-3 px-3! py-1.5! text-sm! font-semibold! text-color-main!"
            icon={expanded ? <ChevronUpIcon size={16} /> : <ChevronDownIcon size={16} />}
            onClick={() => onToggle(parentId)}
            data-gamepad-action
          >
            {expanded
              ? t('gameReviews.hideReplies')
              : t('gameReviews.showMoreReplies', {
                  count: countReplies(nodes.slice(VISIBLE_REPLIES)),
                })}
          </Button>
        </ReviewThreadRow>
      )}
    </AnimatePresence>
  );
};
