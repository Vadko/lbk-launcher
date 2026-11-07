import type { QueryClient } from '@tanstack/react-query';
import type { GameReviewReply, ReviewAuthorIdentity } from '@/shared/game-reviews-types';
import { useReviewAuthorStore } from '../store/useReviewAuthorStore';
import { isOutcomeUnknown } from '../utils/isOutcomeUnknown';
import { nextReplyTime } from '../utils/nextReplyTime';
import { unlistedReply } from '../utils/unlistedReply';
import { findReviewWrite, forgetReviewWrite } from './entryWrites';
import { refreshGameReviews } from './refreshGameReviews';
import type { ReviewThreadView } from './reviewViewTypes';
import type { ReviewWrite } from './reviewWrite';

export function createReviewActions(
  queryClient: QueryClient,
  gameId: string,
  mutate: (write: ReviewWrite) => void,
  // The nickname the pages were fetched with
  viewer: ReviewAuthorIdentity | null
) {
  const write = (variables: ReviewWrite) => {
    forgetReviewWrite(queryClient, gameId, variables.entryId);
    mutate(variables);
  };

  return {
    // False when the picker was closed, so the composer keeps its text
    sendReply: async (
      thread: ReviewThreadView,
      text: string,
      parentId: string | null
    ): Promise<boolean> => {
      // A public thread shows its writer's nickname, so a reply there waits until the machine has one
      const author =
        viewer ??
        (thread.isPublic ? await useReviewAuthorStore.getState().ensureAuthor() : null);
      if (thread.isPublic && !author) {
        return false;
      }
      const reply: GameReviewReply = {
        id: crypto.randomUUID(),
        text,
        // The thread view holds the replies still checking or failed, so the new one is dated after them too
        createdAt: nextReplyTime(thread, Date.now()),
        editedAt: null,
        author: {
          role: 'player',
          name: author?.name ?? null,
          avatarSeed: author?.avatarSeed ?? null,
          isMine: true,
        },
        moderation: 'pending',
        pendingText: null,
        parentId,
      };
      write({
        kind: 'reply',
        entryId: reply.id,
        reviewId: thread.id,
        isPublic: thread.isPublic,
        reply,
      });
      return true;
    },
    edit: (thread: ReviewThreadView, entryId: string, text: string) => {
      const previous = findReviewWrite(queryClient, gameId, entryId)?.state;
      const unlisted = unlistedReply(thread, entryId, previous);
      write({
        kind: 'edit',
        entryId,
        reviewId: thread.id,
        isPublic: thread.isPublic,
        text,
        ...(unlisted && { unlisted }),
      });
    },
    resend: (entryId: string) => {
      const variables = findReviewWrite(queryClient, gameId, entryId)?.state.variables;
      if (variables) {
        write(variables);
      }
    },
    discard: (entryId: string) => {
      const state = findReviewWrite(queryClient, gameId, entryId)?.state;
      const failure = state?.error?.failure;
      const carried = state?.variables?.kind === 'edit' && state.variables.unlisted;
      forgetReviewWrite(queryClient, gameId, entryId);
      // The server may hold what was discarded, and a reply the edit carried shows again only from the pages
      if ((failure && isOutcomeUnknown(failure)) || carried) {
        refreshGameReviews(queryClient, gameId);
      }
    },
  };
}
