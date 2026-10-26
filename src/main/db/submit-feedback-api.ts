import { app } from 'electron';
import { z } from 'zod';
import type {
  FeedbackUploadUrl,
  FeedbackUploadUrlsInput,
  ReviewResult,
  ReviewWriteResult,
  SubmitFeedbackInput,
} from '../../shared/game-reviews-api-types';
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

// Without allowPublish and a captcha token the server keeps the post private
export function submitFeedback({
  id,
  gameId,
  type,
  message,
  screenshotPaths,
}: SubmitFeedbackInput): Promise<ReviewResult<ReviewWriteResult>> {
  return callReviewFunction(
    'submit-feedback',
    {
      id,
      gameId,
      type,
      message,
      ...(screenshotPaths.length > 0 && { screenshotPaths }),
      version: app.getVersion(),
      platform: process.platform,
      arch: process.arch,
      osVersion: getOsVersion(),
    },
    writeResultSchema
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
