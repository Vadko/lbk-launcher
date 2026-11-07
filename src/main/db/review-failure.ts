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
  'gateway_refused',
]);

const envelopeSchema = z.object({ error: z.enum(REVIEW_ERROR_CODES) });
const unknownEnvelopeSchema = z.object({ error: z.string() });

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

export async function httpFailure(error: unknown, call: string): Promise<ReviewFailure> {
  const http = await readFunctionsErrorBody(error);
  // No HTTP answer at all: offline, timed out, or a relay error
  if (!http) {
    return reviewFailure('unreachable', call);
  }
  const envelope = envelopeSchema.safeParse(http.body);
  if (envelope.success) {
    return reviewFailure(envelope.data.error, call);
  }
  // The gateway answers without the envelope
  if (http.status === 429) {
    return reviewFailure('rate_limit', call);
  }
  if (http.status === 408 || http.status >= 500) {
    return reviewFailure('unreachable', call);
  }
  // Both fail every resend the same way; only a code newer than this build is expected from a shipped launcher
  const unknown = unknownEnvelopeSchema.safeParse(http.body);
  return unknown.success
    ? reviewFailure('refused', call, `HTTP ${http.status} ${unknown.data.error}`)
    : reviewFailure('gateway_refused', call, `HTTP ${http.status}`);
}
