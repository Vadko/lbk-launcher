import { type Mutation, mutationOptions, type QueryClient } from '@tanstack/react-query';
import type {
  ReviewEditResult,
  ReviewFailure,
  ReviewResult,
  ReviewWriteResult,
} from '@/shared/game-reviews-api-types';
import type { GameReviewReply } from '@/shared/game-reviews-types';
import { useReviewAuthorStore } from '../store/useReviewAuthorStore';
import { useSubscriptionsStore } from '../store/useSubscriptionsStore';
import { type ModerationVerdict, moderationVerdict } from '../utils/moderationVerdict';
import type { ReviewRefusalReason } from '../utils/reviewRefusalMessage';
import { reviewRefusalNotice } from '../utils/reviewRefusalNotice';
import { gameReviewsQueryKey, reviewWritesKey } from './gameReviewsQueryKey';
import { sendReviewEdit, sendReviewReply } from './reviewsClient';

export type ReviewWrite = {
  // Client-made for a reply, so a resend after a lost answer cannot post twice
  entryId: string;
  // The thread the entry belongs to
  reviewId: string;
  isPublic: boolean;
} & ({ kind: 'reply'; reply: GameReviewReply } | { kind: 'edit'; text: string });

export interface ReviewAnswer {
  // Null when the server refused the write and stored nothing
  verdict: ModerationVerdict | null;
  refusal: ReviewRefusalReason | null;
  answeredAt: number;
}

// A failure a resend may get past, so the write stays with its resend button
export class ReviewWriteError extends Error {
  constructor(readonly failure: ReviewFailure) {
    super(failure.code);
  }
}

export type ReviewWriteMutation = Mutation<ReviewAnswer, ReviewWriteError, ReviewWrite>;

type WriteResult = ReviewResult<ReviewWriteResult | ReviewEditResult>;

const send = (write: ReviewWrite): Promise<WriteResult> =>
  write.kind === 'reply'
    ? sendReviewReply({
        id: write.entryId,
        reviewId: write.reviewId,
        parentId: write.reply.parentId,
        text: write.reply.text,
        isPublic: write.isPublic,
      })
    : sendReviewEdit({ id: write.entryId, text: write.text, isPublic: write.isPublic });

function answerOf(
  write: ReviewWrite,
  result: WriteResult
): Omit<ReviewAnswer, 'answeredAt'> {
  if (!result.ok) {
    // A reply is refused as not found when its thread or the reply it answers is gone
    const isTargetGone = write.kind === 'reply' && result.failure.code === 'not_found';
    return {
      verdict: null,
      refusal: isTargetGone ? 'reply_target_gone' : result.failure.code,
    };
  }
  const { outcome } = result.data;
  const verdict = moderationVerdict({
    outcome,
    editRejected: 'editRejected' in result.data && result.data.editRejected,
  });
  const refusals: Partial<Record<ModerationVerdict, ReviewRefusalReason>> = {
    removed: 'removed',
    rolledBack: 'edit_rejected',
  };
  return { verdict, refusal: refusals[verdict] ?? null };
}

export async function writeReview(write: ReviewWrite): Promise<ReviewAnswer> {
  let result = await send(write);
  // The server holds no nickname for this machine: the picker gets one, then the same id goes out again
  if (!result.ok && result.failure.kind === 'needs-author') {
    const authors = useReviewAuthorStore.getState();
    authors.forgetAuthor();
    if (await authors.ensureAuthor()) {
      result = await send(write);
    }
  }
  if (!result.ok && result.failure.kind !== 'rejected') {
    throw new ReviewWriteError(result.failure);
  }
  return { ...answerOf(write, result), answeredAt: Date.now() };
}

export function reviewWriteOptions(
  queryClient: QueryClient,
  gameId: string,
  gameName: string
) {
  return mutationOptions<ReviewAnswer, ReviewWriteError, ReviewWrite>({
    mutationKey: reviewWritesKey(gameId),
    mutationFn: writeReview,
    // Main reports an unreachable server as a failure, which a paused mutation would hide
    networkMode: 'always',
    // A failed write waits for its resend or discard, in whichever tab it was written
    gcTime: Infinity,
    onSuccess: ({ refusal }, { entryId, reviewId }) => {
      if (refusal) {
        useSubscriptionsStore.getState().showToast(
          reviewRefusalNotice({
            gameId,
            gameName,
            feedbackId: reviewId,
            entryId,
            reason: refusal,
          })
        );
      }
      // Not awaited: the answered write shows until the pages this refetch brings replace it
      void queryClient.invalidateQueries({ queryKey: gameReviewsQueryKey(gameId) });
    },
  });
}
