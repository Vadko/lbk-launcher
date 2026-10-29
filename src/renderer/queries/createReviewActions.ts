import type { QueryClient } from '@tanstack/react-query';
import { flushSync } from 'react-dom';
import type {
  ReviewFailure,
  ReviewResult,
  ReviewWriteResult,
} from '@/shared/game-reviews-api-types';
import type {
  GameReview,
  GameReviewOutcome,
  GameReviewReply,
  ReviewAuthorIdentity,
} from '@/shared/game-reviews-types';
import { useReviewAuthorStore } from '../store/useReviewAuthorStore';
import { useReviewOverlayStore } from '../store/useReviewOverlayStore';
import { editDeadline } from '../utils/editDeadline';
import { handOver } from '../utils/handOver';
import { isOutcomeUnknown } from '../utils/isOutcomeUnknown';
import {
  findEntry,
  findThread,
  nextReplyTime,
  type ReviewPages,
  updateEntry,
} from '../utils/reviewCache';
import type { ReviewWriteDraft } from '../utils/reviewOverlay';
import { gameReviewsQueryKey } from './gameReviewsQueryKey';
import { sendReviewEdit, sendReviewReply } from './reviewsClient';

interface WritePlan {
  draft: ReviewWriteDraft;
  request: () => Promise<ReviewResult<ReviewWriteResult>>;
  // The server refuses an edit once its window closed, so a resend after it is pointless
  resendUntil: number;
  afterDone?: (outcome: GameReviewOutcome) => void;
  // The picker already opened for this write, so another needs-author answer waits for a click
  askedForAuthor?: boolean;
}

function signed(draft: ReviewWriteDraft, author: ReviewAuthorIdentity): ReviewWriteDraft {
  return draft.kind === 'reply'
    ? {
        ...draft,
        reply: { ...draft.reply, author: { ...draft.reply.author, ...author } },
      }
    : draft;
}

export function createReviewActions(queryClient: QueryClient, gameId: string) {
  const queryKey = gameReviewsQueryKey(gameId);
  const overlay = () => useReviewOverlayStore.getState();
  const pages = () => queryClient.getQueryData<ReviewPages>(queryKey);
  const isCurrent = (entryId: string, attempt: number) =>
    overlay().writeOf(gameId, entryId)?.attempt === attempt;
  // Replies still checking or failed live only in the overlay, yet a new reply has to be dated after them too
  const withHeldReplies = (thread: GameReview): GameReview => ({
    ...thread,
    replies: [
      ...thread.replies,
      ...[...(overlay().games.get(gameId)?.values() ?? [])].flatMap((write) =>
        write.kind === 'reply' && write.reviewId === thread.id ? [write.reply] : []
      ),
    ],
  });

  // The overlay notifies React at once, so flushSync closes the composer in the commit that shows the entry
  const send = (entryId: string, plan: WritePlan, onShown?: () => void) => {
    const attempt = flushSync(() => {
      const started = overlay().start(gameId, entryId, plan.draft);
      onShown?.();
      return started;
    });
    return settle(entryId, attempt, plan);
  };

  // The server holds no nickname for this machine: the picker gets one, then the same id goes out again
  const settleWithAuthor = async (
    entryId: string,
    attempt: number,
    plan: WritePlan
  ): Promise<void> => {
    const authors = useReviewAuthorStore.getState();
    authors.forgetAuthor();
    const author = await authors.ensureAuthor();
    if (!author || !isCurrent(entryId, attempt)) {
      return;
    }
    if (plan.draft.kind === 'edit') {
      queryClient.setQueryData<ReviewPages>(
        queryKey,
        (data) =>
          data &&
          updateEntry(data, entryId, (entry) => ({
            ...entry,
            author: { ...entry.author, ...author },
          }))
      );
    }
    await send(entryId, {
      ...plan,
      draft: signed(plan.draft, author),
      askedForAuthor: true,
    });
  };

  const resendFor = (
    entryId: string,
    attempt: number,
    plan: WritePlan,
    failure: ReviewFailure
  ) => {
    const again =
      failure.kind === 'needs-author'
        ? () => settleWithAuthor(entryId, attempt, plan)
        : () => send(entryId, plan);
    // A discarded write stays discarded
    return async () => {
      if (isCurrent(entryId, attempt) && Date.now() < plan.resendUntil) {
        await again();
      }
    };
  };

  const settle = async (entryId: string, attempt: number, plan: WritePlan) => {
    const result = await plan.request();
    if (!isCurrent(entryId, attempt)) {
      return;
    }
    if (!result.ok) {
      const { failure } = result;
      if (failure.kind === 'rejected') {
        overlay().drop(gameId, entryId, attempt);
        return;
      }
      const resend = resendFor(entryId, attempt, plan, failure);
      overlay().fail(gameId, entryId, attempt, failure, resend);
      // The first needs-author answer opens the picker by itself; a later one waits for the resend button
      if (failure.kind === 'needs-author' && !plan.askedForAuthor) {
        await resend();
      }
      return;
    }
    // A page fetched meanwhile holds the pre-answer snapshot and would overwrite the patch
    const wasFetching = queryClient.isFetching({ queryKey }) > 0;
    await queryClient.cancelQueries({ queryKey });
    // A patch marks the pages fresh, so a refetch the cancel dropped (a discard's, say) goes out again
    const refetchCancelled = () => {
      if (wasFetching) {
        void queryClient.invalidateQueries({ queryKey });
      }
    };
    if (!isCurrent(entryId, attempt)) {
      refetchCancelled();
      return;
    }
    const { outcome } = result.data;
    // The cache takes the entry before the overlay lets it go, so no frame goes without it
    queryClient.setQueryData<ReviewPages>(
      queryKey,
      (data) =>
        data && handOver(data, entryId, plan.draft, outcome, new Date().toISOString())
    );
    overlay().drop(gameId, entryId, attempt);
    refetchCancelled();
    plan.afterDone?.(outcome);
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
      const thread = findThread(known, reviewId);
      // Without its thread the reply has no visibility to go out with
      if (!thread) {
        return false;
      }
      const viewer = known?.pages[0]?.viewer ?? null;
      // A public thread shows its writer's nickname, so a reply there waits until the machine has one
      const author = thread.isPublic
        ? (viewer ?? (await useReviewAuthorStore.getState().ensureAuthor(signal)))
        : viewer;
      // The composer was closed while the nickname was looked up or picked, so its text stays unsent
      if (signal.aborted || (thread.isPublic && !author)) {
        return false;
      }
      const reply: GameReviewReply = {
        id: crypto.randomUUID(),
        text,
        createdAt: nextReplyTime(
          withHeldReplies(findThread(pages(), reviewId) ?? thread),
          Date.now()
        ),
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
      void send(
        reply.id,
        {
          draft: { kind: 'reply', reviewId, reply },
          request: () =>
            sendReviewReply({
              id: reply.id,
              reviewId,
              parentId,
              text,
              isPublic: thread.isPublic,
            }),
          resendUntil: Infinity,
        },
        onShown
      );
      return true;
    },
    // An own entry already has its author, so an edit needs no picker up front
    edit: (entryId: string, text: string, onShown: () => void): Promise<boolean> => {
      const found = findEntry(pages(), entryId);
      if (!found) {
        onShown();
        return Promise.resolve(true);
      }
      const { thread, entry: before } = found;
      void send(
        entryId,
        {
          draft: { kind: 'edit', text },
          request: () => sendReviewEdit({ id: entryId, text, isPublic: thread.isPublic }),
          resendUntil: editDeadline(before.createdAt),
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
        },
        onShown
      );
      return Promise.resolve(true);
    },
    resend: async (entryId: string) => {
      const write = overlay().writeOf(gameId, entryId);
      if (write?.state === 'failed') {
        await write.resend();
      }
    },
    discard: (entryId: string) => {
      const write = overlay().writeOf(gameId, entryId);
      overlay().drop(gameId, entryId);
      // The server may hold what was discarded, so the list asks it
      if (write?.state === 'failed' && isOutcomeUnknown(write.failure)) {
        void queryClient.invalidateQueries({ queryKey });
      }
    },
  };
}
