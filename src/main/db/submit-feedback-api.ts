import { app } from 'electron';
import { z } from 'zod';
import type {
  FeedbackUploadUrl,
  FeedbackUploadUrlsInput,
  ReviewResult,
  ReviewWriteResult,
  SubmitFeedbackInput,
} from '../../shared/game-reviews-api-types';
import { takeCaptchaToken } from '../turnstile/tokens';
import { getOsVersion } from '../utils/os-version';
import { callReviewFunction } from './review-request';
import { writeResultSchema } from './review-schemas';

const uploadUrlsSchema: z.ZodType<FeedbackUploadUrl[]> = z
  .object({
    uploadUrls: z.array(
      z.object({ fileName: z.string(), path: z.string(), signedUrl: z.string() })
    ),
  })
  .transform(({ uploadUrls }) => uploadUrls);

// A public post takes a review token; the server answers a resend of a stored post before it checks one
export function submitFeedback({
  id,
  gameId,
  type,
  message,
  screenshotPaths,
  allowPublish,
}: SubmitFeedbackInput): Promise<ReviewResult<ReviewWriteResult>> {
  return callReviewFunction(
    'submit-feedback',
    {
      id,
      gameId,
      type,
      message,
      ...(screenshotPaths.length > 0 && { screenshotPaths }),
      ...(allowPublish && { allowPublish }),
      version: app.getVersion(),
      platform: process.platform,
      arch: process.arch,
      osVersion: getOsVersion(),
    },
    writeResultSchema,
    allowPublish ? { captchaToken: () => takeCaptchaToken('review') } : {}
  );
}

// The post's own id prefixes the paths, the only kind a public post accepts
export function getFeedbackUploadUrls({
  id,
  fileNames,
}: FeedbackUploadUrlsInput): Promise<ReviewResult<FeedbackUploadUrl[]>> {
  return callReviewFunction(
    'submit-feedback?action=upload-urls',
    { id, fileNames },
    uploadUrlsSchema
  );
}
