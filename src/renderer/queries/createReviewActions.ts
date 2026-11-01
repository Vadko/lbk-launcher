import type { QueryClient } from '@tanstack/react-query';
import type { GameReviewReply, ReviewAuthorIdentity } from '@/shared/game-reviews-types';
import { useReviewAuthorStore } from '../store/useReviewAuthorStore';
import { isOutcomeUnknown } from '../utils/isOutcomeUnknown';
import { nextReplyTime } from '../utils/nextReplyTime';
import { findReviewWrite, forgetReviewWrite } from './entryWrites';
import { gameReviewsQueryKey } from './gameReviewsQueryKey';
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
      const authors = useReviewAuthorStore.getState();
      // A public thread shows its writer's nickname, so a reply there waits until the machine has one
      const author =
        viewer ?? (thread.isPublic ? await authors.ensureAuthor() : authors.author);
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
    edit: (thread: ReviewThreadView, entryId: string, text: string) =>
      write({
        kind: 'edit',
        entryId,
        reviewId: thread.id,
        isPublic: thread.isPublic,
        text,
      }),
    resend: (entryId: string) => {
      const variables = findReviewWrite(queryClient, gameId, entryId)?.state.variables;
      if (variables) {
        write(variables);
      }
    },
    discard: (entryId: string) => {
      const failure = findReviewWrite(queryClient, gameId, entryId)?.state.error?.failure;
      forgetReviewWrite(queryClient, gameId, entryId);
      // The server may hold what was discarded, so the list asks it
      if (failure && isOutcomeUnknown(failure)) {
        void queryClient.invalidateQueries({ queryKey: gameReviewsQueryKey(gameId) });
      }
    },
  };
}
