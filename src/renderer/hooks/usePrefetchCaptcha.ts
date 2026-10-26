import { useEffect } from 'react';
import type { TurnstileAction } from '@/main/turnstile/contract';
import { prefetchReviewCaptcha } from '../queries/reviewsClient';

// Main keeps the token; a write sent within its four minutes skips the wait for the challenge
export function usePrefetchCaptcha(action: TurnstileAction, active: boolean): void {
  useEffect(() => {
    if (active) {
      prefetchReviewCaptcha(action);
    }
  }, [action, active]);
}
