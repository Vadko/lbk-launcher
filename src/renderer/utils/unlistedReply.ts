import { D } from '@mobily/ts-belt';
import type { ReviewThreadView } from '../queries/reviewViewTypes';
import type { ReviewWriteMutation, UnlistedReply } from '../queries/reviewWrite';

// The reply as the view shows it, for an edit about to forget the answered write that may be all that shows it
export function unlistedReply(
  thread: ReviewThreadView,
  entryId: string,
  state: ReviewWriteMutation['state'] | undefined
): UnlistedReply | undefined {
  const write = state?.variables;
  const answeredAt =
    write?.kind === 'reply' ? state?.data?.answeredAt : write?.unlisted?.answeredAt;
  const shown = thread.replies.find((reply) => reply.id === entryId);
  if (answeredAt === undefined || !shown || 'removed' in shown) {
    return undefined;
  }
  const reply = D.deleteKeys(shown, ['write', 'isChecking', 'failure', 'isRolledBack']);
  return { reply, answeredAt };
}
