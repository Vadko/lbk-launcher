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

interface Placed {
  node: ReplyNode;
  siblings: ReplyNode[];
}

const byTime = (a: ReplyNode, b: ReplyNode) =>
  Date.parse(a.reply.createdAt) - Date.parse(b.reply.createdAt);

export function buildReplyTree(
  reviewId: string,
  replies: ReviewThreadReplyView[],
  maxDepth: number
): ReplyNode[] {
  const roots: ReplyNode[] = [];
  const byId = new Map(replies.map((reply) => [reply.id, reply]));
  const placed = new Map<string, Placed>();

  // Parents are placed first by id, so a skewed clock cannot detach an answer from them
  const place = (reply: ReviewThreadReplyView): Placed => {
    const existing = placed.get(reply.id);
    if (existing) {
      return existing;
    }
    // A reply whose parent was removed or is not loaded falls back to the first level
    const parentReply = reply.parentId ? byId.get(reply.parentId) : undefined;
    const parent = parentReply ? place(parentReply) : undefined;
    let entry: Placed;
    if (!parent) {
      entry = { node: node(reply, null, reviewId, 1), siblings: roots };
    } else if (parent.node.depth < maxDepth) {
      entry = {
        node: node(reply, null, parent.node.reply.id, parent.node.depth + 1),
        siblings: parent.node.children,
      };
    } else {
      entry = {
        node: node(reply, authorOf(parent.node.reply), parent.node.branchId, maxDepth),
        siblings: parent.siblings,
      };
    }
    entry.siblings.push(entry.node);
    placed.set(reply.id, entry);
    return entry;
  };

  for (const reply of replies) {
    place(reply);
  }
  sortByTime(roots);
  return roots;
}

function sortByTime(nodes: ReplyNode[]): void {
  nodes.sort(byTime);
  for (const item of nodes) {
    sortByTime(item.children);
  }
}

// A removed parent has no author left to name
function authorOf(reply: ReviewThreadReplyView): GameReviewAuthor | null {
  return 'removed' in reply ? null : reply.author;
}

function node(
  reply: ReviewThreadReplyView,
  replyTo: GameReviewAuthor | null,
  branchId: string,
  depth: number
): ReplyNode {
  return { reply, replyTo, branchId, depth, children: [] };
}

export function countReplies(nodes: ReplyNode[]): number {
  return nodes.reduce((sum, item) => sum + 1 + countReplies(item.children), 0);
}
