import { type ReplyNode, VISIBLE_REPLIES } from './replyTree';

// The collapsed branches above an entry, outermost first; null when the tree does not hold it
export function branchesToReveal(nodes: ReplyNode[], entryId: string): string[] | null {
  for (const [index, item] of nodes.entries()) {
    const below =
      item.reply.id === entryId ? [] : branchesToReveal(item.children, entryId);
    if (below) {
      return index < VISIBLE_REPLIES ? below : [item.branchId, ...below];
    }
  }
  return null;
}
