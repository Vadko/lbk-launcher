import { mutationOptions, type QueryClient } from '@tanstack/react-query';
import { useReviewAuthorStore } from '../store/useReviewAuthorStore';
import { trackEvent } from '../utils/analytics';
import type { FeedbackAttempt } from '../utils/feedbackAttempt';
import { feedbackPostsKey } from './gameReviewsQueryKey';
import { refreshGameReviews } from './refreshGameReviews';
import { prefetchReviewCaptcha } from './reviewsClient';
import {
  type FeedbackPost,
  type FeedbackPostResult,
  sendFeedbackPost,
} from './sendFeedbackPost';

export interface FeedbackPostVariables {
  // The post's id, so a moderation event on it knows the form already showed its verdict
  entryId: string;
  attempt: FeedbackAttempt;
  post: FeedbackPost;
}

// Null when nothing went out because the picker was closed, so the form keeps its text
export async function submitFeedbackPost({
  attempt,
  post,
}: FeedbackPostVariables): Promise<FeedbackPostResult | null> {
  const authors = useReviewAuthorStore.getState();
  // A public post shows its writer's nickname, and its screenshots upload only once there is one
  if (post.allowPublish && !(await authors.ensureAuthor())) {
    return null;
  }
  const first = await sendFeedbackPost(attempt, post);
  if (first.ok || first.failure?.kind !== 'needs-author') {
    return first;
  }
  // The refused send spent its captcha token, so a fresh one solves while the picker is open
  authors.forgetAuthor();
  prefetchReviewCaptcha('review');
  if (!(await authors.ensureAuthor())) {
    return first;
  }
  // The same id once more, its screenshots already uploaded; another refusal ends here
  return sendFeedbackPost(first.attempt, post);
}

export function feedbackPostOptions(queryClient: QueryClient, gameName: string) {
  return mutationOptions<FeedbackPostResult | null, Error, FeedbackPostVariables>({
    mutationKey: feedbackPostsKey,
    mutationFn: submitFeedbackPost,
    networkMode: 'always',
    onSuccess: (result, { post }) => {
      if (!result) {
        return;
      }
      if (result.ok) {
        // The post shows in the reviews tab for this machine, private or not
        refreshGameReviews(queryClient, post.gameId);
        trackEvent('Feedback Submitted', {
          'Game Id': post.gameId,
          'Game Name': gameName,
          'Feedback Type': post.type,
          'Allow Publish': post.allowPublish,
          Outcome: result.outcome,
          'Message Length': post.message.length,
          Screenshots: post.screenshots.length,
        });
      } else if (result.failure?.code === 'rate_limit') {
        trackEvent('Feedback Rate Limited', { 'Game Id': post.gameId });
      } else {
        trackEvent('Feedback Error', {
          'Game Id': post.gameId,
          Error: result.failure?.code,
        });
      }
    },
  });
}
