import { notifyManager, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import type { ReviewResult, ReviewWriteResult } from '@/shared/game-reviews-api-types';
import type { GameReviewOutcome, GameReviewReply } from '@/shared/game-reviews-types';
import {
  appendReply,
  type EntryUpdate,
  findEntry,
  findThread,
  nextReplyTime,
  type ReviewPages,
  updateEntry,
} from '../utils/reviewCache';
import {
  afterEdit,
  afterReply,
  markChecking,
  markFailed,
  restored,
  withEdit,
} from '../utils/reviewEntryUpdates';
import { gameReviewsQueryKey } from './gameReviewsQueryKey';
import { sendReviewEdit, sendReviewReply } from './reviewsClient';

interface SettlePlan {
  request: () => Promise<ReviewResult<ReviewWriteResult>>;
  done: (outcome: GameReviewOutcome) => EntryUpdate;
  // The server's final no: the optimistic change is taken back
  rejected: EntryUpdate;
  afterDone?: (outcome: GameReviewOutcome) => void;
}

// Keyed by entry id: the same client id goes out again, so a resend cannot post twice
const failedRequests = new Map<string, () => Promise<void>>();

export function useGameReviewActions(gameId: string) {
  const queryClient = useQueryClient();

  return useMemo(() => {
    const queryKey = gameReviewsQueryKey(gameId);
    const pages = () => queryClient.getQueryData<ReviewPages>(queryKey);
    const patch = (entryId: string, update: EntryUpdate) =>
      queryClient.setQueryData<ReviewPages>(
        queryKey,
        (data) => data && updateEntry(data, entryId, update)
      );

    // React Query hands cache changes to React a task later; onShown joins that same flush
    const showWith = (onShown: () => void, change: () => void) =>
      notifyManager.batch(() => {
        change();
        notifyManager.schedule(onShown);
      });

    // The entry shows at once with a checking badge; the server's answer settles it later
    const settle = async (entryId: string, plan: SettlePlan): Promise<void> => {
      const result = await plan.request();
      // needs-author and needs-captcha wait for a nickname or a token, which a plain resend lacks
      if (!result.ok && result.failure.kind === 'retry') {
        failedRequests.set(entryId, () => settle(entryId, plan));
      } else {
        failedRequests.delete(entryId);
      }
      const update: EntryUpdate = result.ok
        ? plan.done(result.data.outcome)
        : result.failure.kind === 'rejected'
          ? plan.rejected
          : markFailed(result.failure);
      // A page fetched meanwhile holds the pre-answer snapshot and would overwrite the patch
      await queryClient.cancelQueries({ queryKey });
      patch(entryId, update);
      if (result.ok) {
        plan.afterDone?.(result.data.outcome);
      }
    };

    return {
      sendReply: async (
        reviewId: string,
        text: string,
        parentId: string | null,
        onShown: () => void
      ) => {
        await queryClient.cancelQueries({ queryKey });
        const data = pages();
        const viewer = data?.pages[0]?.viewer ?? null;
        const reply: GameReviewReply = {
          id: crypto.randomUUID(),
          text,
          createdAt: nextReplyTime(findThread(data, reviewId), Date.now()),
          editedAt: null,
          author: {
            role: 'player',
            name: viewer?.name ?? null,
            avatarSeed: viewer?.avatarSeed ?? null,
            isMine: true,
          },
          moderation: 'pending',
          pendingText: null,
          isChecking: true,
          parentId,
        };
        showWith(onShown, () =>
          queryClient.setQueryData<ReviewPages>(
            queryKey,
            (current) => current && appendReply(current, reviewId, reply)
          )
        );
        void settle(reply.id, {
          request: () => sendReviewReply({ id: reply.id, reviewId, parentId, text }),
          done: afterReply,
          rejected: () => null,
        });
      },
      edit: async (entryId: string, text: string, onShown: () => void) => {
        await queryClient.cancelQueries({ queryKey });
        const found = findEntry(pages(), entryId);
        if (!found) {
          onShown();
          return;
        }
        const { thread, entry: before } = found;
        showWith(onShown, () => patch(entryId, withEdit(text)));
        void settle(entryId, {
          request: () => sendReviewEdit({ id: entryId, text }),
          done: (outcome) => afterEdit(outcome, text, new Date().toISOString()),
          rejected: restored(before),
          // The answer cannot tell a kept edit from a rejected one, so the list says which
          afterDone: (outcome) => {
            if (
              thread.isPublic &&
              before.moderation === 'published' &&
              outcome === 'published'
            ) {
              void queryClient.invalidateQueries({ queryKey });
            }
          },
        });
      },
      resend: async (entryId: string) => {
        const request = failedRequests.get(entryId);
        if (!request) {
          return;
        }
        await queryClient.cancelQueries({ queryKey });
        patch(entryId, markChecking);
        void request();
      },
    };
  }, [gameId, queryClient]);
}
