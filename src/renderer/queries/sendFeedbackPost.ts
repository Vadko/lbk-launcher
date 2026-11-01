import type { ReviewFailure } from '@/shared/game-reviews-api-types';
import type { GameReviewOutcome } from '@/shared/game-reviews-types';
import { t } from '@/shared/i18n/i18n';
import type { FeedbackType } from '@/shared/types';
import { useReviewOverlayStore } from '../store/useReviewOverlayStore';
import { afterRefusal, attemptFor, type FeedbackAttempt } from '../utils/feedbackAttempt';
import { feedbackFailureMessage } from '../utils/feedbackFailureMessage';
import { requestFeedbackUploadUrls, sendFeedback } from './reviewsClient';

interface FeedbackScreenshot {
  name: string;
  file: File;
  type: string;
}

export interface FeedbackPost {
  gameId: string;
  type: FeedbackType;
  message: string;
  screenshots: FeedbackScreenshot[];
  allowPublish: boolean;
}

type Refusal = { ok: false; message: string; failure: ReviewFailure | null };

// The attempt to send next time: the same post keeps its id and uploads
export type FeedbackPostResult = ({ ok: true; outcome: GameReviewOutcome } | Refusal) & {
  attempt: FeedbackAttempt;
};

type UploadResult = ({ ok: true; paths: string[] } | Refusal) & {
  uploads: ReadonlyMap<File, string>;
};

// A resend under the same id uploads only what the last attempt did not, so no file is left orphaned
async function uploadScreenshots(
  attempt: FeedbackAttempt,
  screenshots: FeedbackScreenshot[]
): Promise<UploadResult> {
  const uploads = new Map(attempt.uploads);
  const missing = screenshots.filter((shot) => !uploads.has(shot.file));
  if (missing.length > 0) {
    const urls = await requestFeedbackUploadUrls({
      id: attempt.id,
      fileNames: missing.map((shot) => shot.name),
    });
    if (!urls.ok) {
      const message = t('feedbackModal.screenshotsFailed');
      return { ok: false, message, failure: urls.failure, uploads };
    }
    for (const [i, shot] of missing.entries()) {
      const { signedUrl, path } = urls.data[i];
      const response = await fetch(signedUrl, {
        method: 'PUT',
        headers: { 'Content-Type': shot.type },
        body: shot.file,
      }).catch(() => null);
      if (!response?.ok) {
        const message = t('feedbackModal.screenshotFailed', { name: shot.name });
        return { ok: false, message, failure: null, uploads };
      }
      uploads.set(shot.file, path);
    }
  }
  const paths = screenshots.flatMap((shot) => uploads.get(shot.file) ?? []);
  return { ok: true, paths, uploads };
}

export async function sendFeedbackPost(
  previous: FeedbackAttempt,
  post: FeedbackPost
): Promise<FeedbackPostResult> {
  const content = {
    type: post.type,
    message: post.message,
    files: post.screenshots.map((shot) => shot.file),
    allowPublish: post.allowPublish,
  };
  const attempt = attemptFor(previous, content);
  const uploaded = await uploadScreenshots(attempt, post.screenshots);
  const withUploads = { ...attempt, uploads: uploaded.uploads };
  if (!uploaded.ok) {
    const { message, failure } = uploaded;
    return { ok: false, message, failure, attempt: withUploads };
  }

  const overlay = useReviewOverlayStore.getState();
  // A moderation event on the post waits for this answer, so the verdict the form shows is not announced again
  overlay.startPost(attempt.id);
  const sent = await sendFeedback({
    id: attempt.id,
    gameId: post.gameId,
    type: post.type,
    message: post.message,
    screenshotPaths: uploaded.paths,
    allowPublish: post.allowPublish,
  });
  overlay.endPost(attempt.id, sent.ok ? sent.data.outcome : null);
  if (sent.ok) {
    return { ok: true, outcome: sent.data.outcome, attempt: withUploads };
  }
  return {
    ok: false,
    message: feedbackFailureMessage(sent.failure, post.allowPublish, post.type),
    failure: sent.failure,
    attempt: afterRefusal(withUploads, content, sent.failure),
  };
}
