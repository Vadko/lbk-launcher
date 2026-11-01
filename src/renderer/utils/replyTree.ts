import { A } from '@mobily/ts-belt';
import type { GameReviewAuthor } from '@/shared/game-reviews-types';
import type { ReviewThreadReplyView } from '../queries/reviewViewTypes';

// A branch shows this many replies until it is expanded
export const VISIBLE_REPLIES = 3;

export interface ReplyNode {
  reply: ReviewThreadReplyView;
  // Set when the answered entry sits on the last level, so this one is shown beside it
  replyTo: GameReviewAuthor | null;
  // The entry whose branch holds this node: the review for the first level
  branchId: string;
  depth: number;
  children: ReplyNode[];
}

const byTime = (a: ReplyNode, b: ReplyNode) =>
  Date.parse(a.reply.createdAt) - Date.parse(b.reply.createdAt);

export function buildReplyTree(
  reviewId: string,
  replies: ReviewThreadReplyView[],
  maxDepth: number
): ReplyNode[] {
  const ids = new Set(replies.map((reply) => reply.id));
  // A reply whose parent was removed or is not loaded falls back to the first level
  const answers = A.groupBy(replies, (reply) =>
    reply.parentId !== null && ids.has(reply.parentId) ? reply.parentId : reviewId
  );

  const level = (
    parentId: string,
    depth: number,
    branchId: string,
    replyTo: GameReviewAuthor | null
  ): ReplyNode[] =>
    (answers[parentId] ?? [])
      .flatMap((reply) => {
        if (depth < maxDepth) {
          const children = level(reply.id, depth + 1, reply.id, null);
          return [node(reply, replyTo, branchId, depth, children)];
        }
        // Answers to an entry on the last level sit beside it
        const beside = level(reply.id, depth, branchId, authorOf(reply));
        return [node(reply, replyTo, branchId, depth, []), ...beside];
      })
      .sort(byTime);

  return level(reviewId, 1, reviewId, null);
}

// A removed parent has no author left to name
function authorOf(reply: ReviewThreadReplyView): GameReviewAuthor | null {
  return 'removed' in reply ? null : reply.author;
}

function node(
  reply: ReviewThreadReplyView,
  replyTo: GameReviewAuthor | null,
  branchId: string,
  depth: number,
  children: ReplyNode[]
): ReplyNode {
  return { reply, replyTo, branchId, depth, children };
}

export function countReplies(nodes: ReplyNode[]): number {
  return nodes.reduce((sum, item) => sum + 1 + countReplies(item.children), 0);
}
