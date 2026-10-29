import { useReviewAuthorStore } from '../store/useReviewAuthorStore';
import type { FeedbackAttempt } from '../utils/feedbackAttempt';
import { prefetchReviewCaptcha } from './reviewsClient';
import {
  type FeedbackPost,
  type FeedbackPostResult,
  sendFeedbackPost,
} from './sendFeedbackPost';

type Send = () => Promise<FeedbackPostResult>;

interface FeedbackSubmit {
  attempt: FeedbackAttempt;
  post: FeedbackPost;
  // Aborted when the modal closes: a send under way still runs to its end, but no picker or resend starts
  signal: AbortSignal;
  // Wraps each send in the button's pending phase; the picker stays outside it
  inPhase: (send: Send) => Promise<FeedbackPostResult>;
  // A refused send is about to open the picker, so the button drops its cross
  beforePicker: () => void;
}

// Null when nothing went out because the picker or the modal was closed first, so the form keeps its text
export async function submitFeedbackPost({
  attempt,
  post,
  signal,
  inPhase,
  beforePicker,
}: FeedbackSubmit): Promise<FeedbackPostResult | null> {
  const authors = useReviewAuthorStore.getState();
  // A public post shows its writer's nickname, and its screenshots upload only once there is one
  if (post.allowPublish && !(await authors.ensureAuthor(signal))) {
    return null;
  }
  if (signal.aborted) {
    return null;
  }
  const first = await inPhase(() => sendFeedbackPost(attempt, post));
  if (first.ok || first.failure?.kind !== 'needs-author' || signal.aborted) {
    return first;
  }
  // The refused send spent its captcha token, so a fresh one solves while the picker is open
  beforePicker();
  authors.forgetAuthor();
  prefetchReviewCaptcha('review');
  const author = await authors.ensureAuthor(signal);
  if (!author || signal.aborted) {
    return first;
  }
  // The same id once more, its screenshots already uploaded; another refusal ends here
  return inPhase(() => sendFeedbackPost(first.attempt, post));
}
