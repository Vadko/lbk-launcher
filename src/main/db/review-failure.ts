import { z } from 'zod';
import {
  REVIEW_ERROR_CODES,
  type ReviewFailure,
  type ReviewFailureKind,
} from '../../shared/game-reviews-api-types';
import { readFunctionsErrorBody } from './functions-error';

type ReviewFailureCode = ReviewFailure['code'];

// A resend with the same id can pass: a fresh token, a quota that clears, a write that may have committed
const RETRY = new Set<ReviewFailureCode>([
  'captcha_failed',
  'rate_limit',
  'daily_limit',
  'internal',
  'captcha_unavailable',
  'nicknames_exhausted',
  'unreachable',
  'bad_response',
]);

// console.error becomes a Sentry event, so it is kept for our own bugs and server faults
const SENTRY = new Set<ReviewFailureCode>([
  'invalid_body',
  'method_not_allowed',
  'not_moderated',
  'internal',
  'bad_response',
]);

const envelopeSchema = z.object({ error: z.enum(REVIEW_ERROR_CODES) });

function kindOf(code: ReviewFailureCode): ReviewFailureKind {
  if (code === 'author_required') {
    return 'needs-author';
  }
  return RETRY.has(code) ? 'retry' : 'rejected';
}

export function reviewFailure(
  code: ReviewFailureCode,
  call: string,
  detail?: string
): ReviewFailure {
  console[SENTRY.has(code) ? 'error' : 'warn'](
    `[Reviews] ${call} failed: ${code}`,
    ...(detail === undefined ? [] : [detail])
  );
  return { code, kind: kindOf(code) };
}

export async function failureCodeOf(error: unknown): Promise<ReviewFailureCode> {
  const http = await readFunctionsErrorBody(error);
  // No HTTP answer at all: offline, timed out, or a relay error
  if (!http) {
    return 'unreachable';
  }
  const envelope = envelopeSchema.safeParse(http.body);
  if (envelope.success) {
    return envelope.data.error;
  }
  // The gateway answers without the envelope
  if (http.status === 429) {
    return 'rate_limit';
  }
  return http.status >= 500 ? 'unreachable' : 'bad_response';
}
