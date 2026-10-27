import { notifyManager, type QueryClient } from '@tanstack/react-query';
import type {
  ReviewFailure,
  ReviewResult,
  ReviewWriteResult,
} from '@/shared/game-reviews-api-types';
import type { GameReviewOutcome, GameReviewReply } from '@/shared/game-reviews-types';
import { useReviewAuthorStore } from '../store/useReviewAuthorStore';
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
  // The picker already opened for this write, so another needs-author answer waits for a click
  askedForAuthor?: boolean;
}

// Keyed by entry id: the same client id goes out again, so a resend cannot post twice
const failedRequests = new Map<string, () => Promise<void>>();

export function createReviewActions(queryClient: QueryClient, gameId: string) {
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

  // The server holds no nickname for this machine: the picker gets one, then the same id goes out again
  const settleWithAuthor = async (entryId: string, plan: SettlePlan): Promise<void> => {
    const authors = useReviewAuthorStore.getState();
    authors.forgetAuthor();
    const author = await authors.ensureAuthor();
    if (!author) {
      return;
    }
    await queryClient.cancelQueries({ queryKey });
    patch(entryId, (entry) =>
      markChecking({ ...entry, author: { ...entry.author, ...author } })
    );
    await settle(entryId, plan);
  };

  const resendFor = (
    entryId: string,
    plan: SettlePlan,
    failure: ReviewFailure
  ): (() => Promise<void>) | null => {
    switch (failure.kind) {
      case 'retry':
        return async () => {
          await queryClient.cancelQueries({ queryKey });
          patch(entryId, markChecking);
          await settle(entryId, plan);
        };
      case 'needs-author':
        return () => settleWithAuthor(entryId, { ...plan, askedForAuthor: true });
      case 'rejected':
        return null;
    }
  };

  // The entry shows at once with a checking badge; the server's answer settles it later
  const settle = async (entryId: string, plan: SettlePlan): Promise<void> => {
    const result = await plan.request();
    const resend = result.ok ? null : resendFor(entryId, plan, result.failure);
    if (resend) {
      failedRequests.set(entryId, resend);
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
    } else if (result.failure.kind === 'needs-author' && !plan.askedForAuthor && resend) {
      // The first needs-author answer opens the picker by itself; a later one waits for the resend button
      await resend();
    }
  };

  return {
    // False when the write was called off before it went out, so the composer keeps its text
    sendReply: async (
      reviewId: string,
      text: string,
      parentId: string | null,
      onShown: () => void,
      signal: AbortSignal
    ): Promise<boolean> => {
      const known = pages();
      const isPublic = findThread(known, reviewId)?.isPublic ?? false;
      const viewer = known?.pages[0]?.viewer ?? null;
      // A public thread shows its writer's nickname, so a reply there waits until the machine has one
      const author = isPublic
        ? (viewer ?? (await useReviewAuthorStore.getState().ensureAuthor(signal)))
        : viewer;
      // The composer was closed while the nickname was looked up or picked, so its text stays unsent
      if (signal.aborted || (isPublic && !author)) {
        return false;
      }
      await queryClient.cancelQueries({ queryKey });
      const thread = findThread(pages(), reviewId);
      const reply: GameReviewReply = {
        id: crypto.randomUUID(),
        text,
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
        request: () =>
          sendReviewReply({ id: reply.id, reviewId, parentId, text, isPublic }),
        done: afterReply,
        rejected: () => null,
      });
      return true;
    },
    // An own entry already has its author, so an edit needs no picker up front
    edit: async (
      entryId: string,
      text: string,
      onShown: () => void
    ): Promise<boolean> => {
      await queryClient.cancelQueries({ queryKey });
      const found = findEntry(pages(), entryId);
      if (!found) {
        onShown();
        return true;
      }
      const { thread, entry: before } = found;
      showWith(onShown, () => patch(entryId, withEdit(text)));
      void settle(entryId, {
        request: () => sendReviewEdit({ id: entryId, text, isPublic: thread.isPublic }),
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
      return true;
    },
    resend: async (entryId: string) => {
      await failedRequests.get(entryId)?.();
    },
  };
}
