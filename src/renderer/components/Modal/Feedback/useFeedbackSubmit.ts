import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useActionPhase } from '@/renderer/hooks/useActionPhase';
import type { GameReviewOutcome } from '@/shared/game-reviews-types';
import { gameReviewsQueryKey } from '../../../queries/gameReviewsQueryKey';
import type { FeedbackPost, FeedbackPostResult } from '../../../queries/sendFeedbackPost';
import { submitFeedbackPost } from '../../../queries/submitFeedbackPost';
import { trackEvent } from '../../../utils/analytics';
import { freshAttempt } from '../../../utils/feedbackAttempt';

interface SentPost {
  allowPublish: boolean;
  outcome: GameReviewOutcome;
}

export function useFeedbackSubmit(isOpen: boolean, gameName: string) {
  // The post's id and uploads, so a resend of the same post is stored once and uploads nothing twice
  const [attempt, setAttempt] = useState(freshAttempt);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<SentPost | null>(null);
  const queryClient = useQueryClient();
  const { phase, isPending, run, reset: resetPhase } = useActionPhase();
  const openSignal = useRef<AbortSignal | null>(null);
  // The open's signal while its submit runs, picker included, so a second click starts nothing
  const running = useRef<AbortSignal | null>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    const controller = new AbortController();
    openSignal.current = controller.signal;
    return () => {
      controller.abort();
      // A send still running belongs to the closed form: the next open shows neither its spinner nor its result
      resetPhase();
    };
  }, [isOpen, resetPhase]);

  const inPhase = useCallback(
    (send: () => Promise<FeedbackPostResult>) => run(send, { isSuccess: (r) => r.ok }),
    [run]
  );

  const submit = useCallback(
    async (post: FeedbackPost) => {
      const signal = openSignal.current;
      if (!signal || signal.aborted || running.current === signal) {
        return;
      }
      running.current = signal;
      setError(null);
      const result = await submitFeedbackPost({
        attempt,
        post,
        signal,
        inPhase,
        beforePicker: resetPhase,
      }).finally(() => {
        if (running.current === signal) {
          running.current = null;
        }
      });
      if (!result) {
        return;
      }

      if (result.ok) {
        // The post shows in the reviews tab for this machine, private or not
        void queryClient.invalidateQueries({
          queryKey: gameReviewsQueryKey(post.gameId),
        });
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
      // A closed modal starts over on its next open
      if (signal.aborted) {
        return;
      }
      setAttempt(result.attempt);
      if (result.ok) {
        setSent({ allowPublish: post.allowPublish, outcome: result.outcome });
      } else {
        setError(result.message);
      }
    },
    [attempt, gameName, inPhase, resetPhase, queryClient]
  );

  const reset = useCallback(() => {
    setAttempt(freshAttempt());
    setError(null);
    setSent(null);
  }, []);

  return { phase, isPending, error, sent, submit, reset };
}
