import { z } from 'zod';
import { errorMessage } from '../../shared/errors';
import type { ReviewResult } from '../../shared/game-reviews-api-types';
import { getMachineId, IS_E2E } from '../tracking';
import { httpFailure, reviewFailure } from './review-failure';
import { getSupabaseClient } from './supabase-client';

type ReviewEndpoint =
  | 'reviews?action=list'
  | 'reviews?action=author'
  | 'reviews?action=spin'
  | 'reviews?action=claim'
  | 'reviews?action=reply'
  | 'reviews?action=edit'
  | 'submit-feedback'
  | 'submit-feedback?action=upload-urls'
  | 'get-feedback-replies';

// Everything else is a write, which never leaves an E2E run built with the production keys
const READS = new Set<ReviewEndpoint>([
  'reviews?action=list',
  'reviews?action=author',
  'get-feedback-replies',
]);

const READ_TIMEOUT_MS = 15_000;
// Siteverify (2 × 4 s), inline moderation (6 s) and the RPCs can hold a public write ~15 s
const WRITE_TIMEOUT_MS = 30_000;

// Main alone adds the machine id, after the caller's fields, so nothing the renderer sends can replace it
export async function callReviewFunction<T>(
  endpoint: ReviewEndpoint,
  body: Record<string, unknown>,
  schema: z.ZodType<T>,
  // A public write's single-use Turnstile token, null when none can be had
  captchaToken?: () => Promise<string | null>
): Promise<ReviewResult<T>> {
  const read = READS.has(endpoint);
  if (!read && IS_E2E) {
    return { ok: false, failure: reviewFailure('e2e_mode', endpoint) };
  }
  const machineId = getMachineId();
  try {
    // Without a token a write still goes out: a resend is answered before the captcha, and REVIEWS_CAPTCHA=off passes it
    const token = captchaToken ? await captchaToken() : null;
    const { data, error } = await getSupabaseClient().functions.invoke<unknown>(
      endpoint,
      {
        body: {
          ...body,
          ...(machineId ? { machineId } : {}),
          ...(token ? { captchaToken: token } : {}),
        },
        timeout: read ? READ_TIMEOUT_MS : WRITE_TIMEOUT_MS,
      }
    );
    if (error) {
      return { ok: false, failure: await httpFailure(error, endpoint) };
    }
    const parsed = schema.safeParse(data);
    if (!parsed.success) {
      // Issues name paths and expectations, never the values, so no user text reaches Sentry
      const detail = z.prettifyError(parsed.error);
      return { ok: false, failure: reviewFailure('bad_response', endpoint, detail) };
    }
    return { ok: true, data: parsed.data };
  } catch (error) {
    console.error(`[Reviews] ${endpoint} threw:`, errorMessage(error));
    return { ok: false, failure: reviewFailure('unreachable', endpoint) };
  }
}
