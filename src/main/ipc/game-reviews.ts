import { ipcMain } from 'electron';
import { z } from 'zod';
import { Constants } from '../../lib/database.types';
import type {
  FeedbackUploadUrlsInput,
  GameReviewsListInput,
  NicknameClaimInput,
  NicknameSpinInput,
  ReviewEditInput,
  ReviewReplyInput,
  ReviewResult,
  SubmitFeedbackInput,
} from '../../shared/game-reviews-api-types';
import { fetchGameReviews } from '../db/game-reviews-api';
import { editReviewEntry, replyToReview } from '../db/review-actions-api';
import {
  claimReviewNickname,
  getReviewAuthor,
  spinReviewNickname,
} from '../db/review-author-api';
import { reviewFailure } from '../db/review-failure';
import { getFeedbackUploadUrls, submitFeedback } from '../db/submit-feedback-api';
import { syncReviewEvents } from '../review-events';
import { turnstileActionSchema } from '../turnstile/contract';
import { prefetchCaptchaToken } from '../turnstile/tokens';

const MAX_TEXT_CODE_POINTS = 1000;
const MAX_SCREENSHOTS = 5;

const id = z.guid();

// The server's own rule: trimmed, not empty, at most 1000 code points
const text = z
  .string()
  .trim()
  .refine((value) => value.length > 0 && [...value].length <= MAX_TEXT_CODE_POINTS);

const listInput: z.ZodType<GameReviewsListInput> = z.object({
  gameId: id,
  cursor: z.string().max(128).nullable(),
});

const replyInput: z.ZodType<ReviewReplyInput> = z.object({
  id,
  reviewId: id,
  parentId: id.nullable(),
  text,
  isPublic: z.boolean(),
});

const editInput: z.ZodType<ReviewEditInput> = z.object({
  id,
  text,
  isPublic: z.boolean(),
});

const spinInput: z.ZodType<NicknameSpinInput> = z.object({
  spinId: id.nullable(),
  hold: z.object({ avatar: z.boolean(), adjective: z.boolean(), noun: z.boolean() }),
});

const claimInput: z.ZodType<NicknameClaimInput> = z.object({ spinId: id });

const submitInput: z.ZodType<SubmitFeedbackInput> = z.object({
  id,
  gameId: id,
  type: z.enum(Constants.public.Enums.feedback_type),
  message: text,
  screenshotPaths: z.array(z.string().max(200)).max(MAX_SCREENSHOTS),
  allowPublish: z.boolean(),
});

const uploadUrlsInput: z.ZodType<FeedbackUploadUrlsInput> = z.object({
  id,
  fileNames: z.array(z.string().max(255)).min(1).max(MAX_SCREENSHOTS),
});

// The renderer is not trusted with shapes, so a malformed call fails here instead of at the server
function handle<I, T>(
  channel: string,
  schema: z.ZodType<I>,
  run: (input: I) => Promise<ReviewResult<T>>
): void {
  ipcMain.handle(channel, (_, raw: unknown): Promise<ReviewResult<T>> => {
    const input = schema.safeParse(raw);
    return input.success
      ? run(input.data)
      : Promise.resolve({ ok: false, failure: reviewFailure('invalid_body', channel) });
  });
}

export function setupGameReviewsHandlers(): void {
  handle('reviews:list', listInput, fetchGameReviews);
  handle('reviews:reply', replyInput, replyToReview);
  handle('reviews:edit', editInput, editReviewEntry);
  ipcMain.handle('reviews:author', () => getReviewAuthor());
  handle('reviews:spin', spinInput, spinReviewNickname);
  handle('reviews:claim', claimInput, claimReviewNickname);
  handle('reviews:submit-feedback', submitInput, submitFeedback);
  handle('reviews:upload-urls', uploadUrlsInput, getFeedbackUploadUrls);
  ipcMain.handle('reviews:sync-events', (event) => syncReviewEvents(event.sender));
  ipcMain.on('reviews:prefetch-captcha', (_, raw: unknown) => {
    const action = turnstileActionSchema.safeParse(raw);
    if (action.success) {
      prefetchCaptchaToken(action.data);
    } else {
      console.warn('[Reviews] reviews:prefetch-captcha ignored a malformed action');
    }
  });
}
