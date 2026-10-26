import type { ReviewFailure } from '@/shared/game-reviews-api-types';
import { t } from '@/shared/i18n/i18n';
import type { FeedbackType } from '@/shared/types';
import { afterRefusal, attemptFor, type FeedbackAttempt } from '../utils/feedbackAttempt';
import { requestFeedbackUploadUrls, sendFeedback } from './reviewsClient';

interface FeedbackScreenshot {
  name: string;
  file: File;
  type: string;
}

interface FeedbackPost {
  gameId: string;
  type: FeedbackType;
  message: string;
  screenshots: FeedbackScreenshot[];
}

type Refusal = { ok: false; message: string; failure: ReviewFailure | null };

// The attempt to send next time: the same post keeps its id and uploads
type FeedbackPostResult = ({ ok: true } | Refusal) & { attempt: FeedbackAttempt };

type UploadResult = ({ ok: true; paths: string[] } | Refusal) & {
  uploads: ReadonlyMap<File, string>;
};

function failureMessage(failure: ReviewFailure): string {
  if (failure.code === 'rate_limit') {
    return t('feedbackModal.rateLimit');
  }
  return failure.code === 'unreachable'
    ? t('feedbackModal.networkError')
    : t('feedbackModal.sendFailed');
}

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
      const target = urls.data[i];
      const response = target
        ? await fetch(target.signedUrl, {
            method: 'PUT',
            headers: { 'Content-Type': shot.type },
            body: shot.file,
          }).catch(() => null)
        : null;
      if (!target || !response?.ok) {
        const message = t('feedbackModal.screenshotFailed', { name: shot.name });
        return { ok: false, message, failure: null, uploads };
      }
      uploads.set(shot.file, target.path);
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
  };
  const attempt = attemptFor(previous, content);
  const uploaded = await uploadScreenshots(attempt, post.screenshots);
  const withUploads = { ...attempt, uploads: uploaded.uploads };
  if (!uploaded.ok) {
    const { message, failure } = uploaded;
    return { ok: false, message, failure, attempt: withUploads };
  }

  const sent = await sendFeedback({
    id: attempt.id,
    gameId: post.gameId,
    type: post.type,
    message: post.message,
    screenshotPaths: uploaded.paths,
  });
  if (sent.ok) {
    return { ok: true, attempt: withUploads };
  }
  return {
    ok: false,
    message: failureMessage(sent.failure),
    failure: sent.failure,
    attempt: afterRefusal(withUploads, content, sent.failure),
  };
}
