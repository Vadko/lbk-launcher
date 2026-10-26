import { z } from 'zod';
import type {
  ReviewErrorCode,
  ReviewFailure,
  ReviewFailureKind,
  ReviewLocalFailureCode,
} from '../../shared/game-reviews-api-types';
import { readFunctionsErrorBody } from './functions-error';

type ReviewFailureCode = ReviewFailure['code'];

interface FailureRule {
  kind: ReviewFailureKind;
  // console.error becomes a Sentry event, so it is kept for our own bugs and server faults
  log: 'warn' | 'error';
}

const SERVER_FAILURES: Record<ReviewErrorCode, FailureRule> = {
  invalid_body: { kind: 'rejected', log: 'error' },
  invalid_hold: { kind: 'rejected', log: 'warn' },
  invalid_candidate: { kind: 'rejected', log: 'warn' },
  // A resend without a new single-use token is refused the same way
  captcha_failed: { kind: 'needs-captcha', log: 'warn' },
  edit_window_closed: { kind: 'rejected', log: 'warn' },
  not_owner: { kind: 'rejected', log: 'warn' },
  banned: { kind: 'rejected', log: 'warn' },
  not_found: { kind: 'rejected', log: 'warn' },
  method_not_allowed: { kind: 'rejected', log: 'error' },
  id_conflict: { kind: 'rejected', log: 'warn' },
  nickname_taken: { kind: 'rejected', log: 'warn' },
  author_exists: { kind: 'rejected', log: 'warn' },
  not_moderated: { kind: 'rejected', log: 'error' },
  author_required: { kind: 'needs-author', log: 'warn' },
  rate_limit: { kind: 'retry', log: 'warn' },
  // It can follow a committed write, and a resend with the same id answers the stored result
  internal: { kind: 'retry', log: 'error' },
  captcha_unavailable: { kind: 'retry', log: 'warn' },
  nicknames_exhausted: { kind: 'retry', log: 'warn' },
};

const LOCAL_FAILURES: Record<ReviewLocalFailureCode, FailureRule> = {
  unreachable: { kind: 'retry', log: 'warn' },
  // A write may have committed before the odd answer, and a resend with the same id is safe
  bad_response: { kind: 'retry', log: 'error' },
  no_machine_id: { kind: 'rejected', log: 'warn' },
  e2e_mode: { kind: 'rejected', log: 'warn' },
};

const FAILURES: Record<ReviewFailureCode, FailureRule> = {
  ...SERVER_FAILURES,
  ...LOCAL_FAILURES,
};

const envelopeSchema = z.object({ error: z.string() });

function isServerCode(code: string): code is ReviewErrorCode {
  return Object.hasOwn(SERVER_FAILURES, code);
}

export function reviewFailure(
  code: ReviewFailureCode,
  call: string,
  detail?: string
): ReviewFailure {
  const { kind, log } = FAILURES[code];
  console[log](
    `[Reviews] ${call} failed: ${code}`,
    ...(detail === undefined ? [] : [detail])
  );
  return { code, kind };
}

export async function failureCodeOf(error: unknown): Promise<ReviewFailureCode> {
  const http = await readFunctionsErrorBody(error);
  // No HTTP answer at all: offline, timed out, or a relay error
  if (!http) {
    return 'unreachable';
  }
  const envelope = envelopeSchema.safeParse(http.body);
  if (envelope.success && isServerCode(envelope.data.error)) {
    return envelope.data.error;
  }
  // The gateway answers without the envelope
  if (http.status === 429) {
    return 'rate_limit';
  }
  return http.status >= 500 ? 'unreachable' : 'bad_response';
}
