import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useActionPhase } from '@/renderer/hooks/useActionPhase';
import { forgetFeedbackPost } from '../../../queries/entryWrites';
import { type FeedbackPost, feedbackContent } from '../../../queries/sendFeedbackPost';
import { feedbackPostOptions } from '../../../queries/submitFeedbackPost';
import { attemptFor, freshAttempt } from '../../../utils/feedbackAttempt';

// The modal mounts afresh on every open, so a send left from a closed form shows nothing here
export function useFeedbackSubmit(gameName: string) {
  const queryClient = useQueryClient();
  const mutation = useMutation(feedbackPostOptions(queryClient, gameName));
  const { phase, attempt: attemptPhase, reset: resetPhase } = useActionPhase();
  const { data: result, variables } = mutation;

  const submit = async (post: FeedbackPost) => {
    if (mutation.isPending) {
      return;
    }
    // The post's id and uploads carry over, so a resend of the same post is stored once and uploads nothing twice
    const previous = result?.attempt ?? variables?.attempt ?? freshAttempt();
    const attempt = attemptFor(previous, feedbackContent(post));
    forgetFeedbackPost(queryClient, attempt.id);
    const sent = await attemptPhase(
      () => mutation.mutateAsync({ entryId: attempt.id, attempt, post }),
      { label: 'Feedback', isSuccess: (answer) => answer?.ok !== false }
    );
    if (sent === null) {
      resetPhase();
    }
  };

  return {
    phase,
    isPending: mutation.isPending,
    error: result && !result.ok ? result.message : null,
    sent:
      result?.ok && variables
        ? {
            type: variables.post.type,
            allowPublish: variables.post.allowPublish,
            outcome: result.outcome,
          }
        : null,
    submit,
  };
}
