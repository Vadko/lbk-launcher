import { z } from 'zod';
import { errorMessage } from '../../shared/errors';
import type { ReviewResult } from '../../shared/game-reviews-api-types';
import { getMachineId, IS_E2E } from '../tracking';
import { reportCaptchaFault } from '../turnstile/report-captcha-fault';
import { failureCodeOf, reviewFailure } from './review-failure';
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

interface EndpointRule {
  // Writes never leave an E2E run, which builds with the production keys
  write: boolean;
  // The list still shows public threads to a machine without an id
  machineId: 'required' | 'optional';
  timeoutMs: number;
}

interface ReviewCallOptions {
  // Seam for Turnstile: each attempt asks for a fresh single-use token, null when none can be had
  captchaToken?: () => Promise<string | null>;
  // Otherwise a write without a token still goes out, so the server's REVIEWS_CAPTCHA=off switch can pass it
  refuseWithoutToken?: boolean;
  // The Date header of a 2xx answer, for a caller that must not trust the local clock
  onServerTime?: (at: string) => void;
}

const READ_TIMEOUT_MS = 15_000;
// Siteverify (2 × 4 s), inline moderation (6 s) and the RPCs can hold a public write ~15 s
const WRITE_TIMEOUT_MS = 30_000;

const ENDPOINTS: Record<ReviewEndpoint, EndpointRule> = {
  'reviews?action=list': {
    write: false,
    machineId: 'optional',
    timeoutMs: READ_TIMEOUT_MS,
  },
  'reviews?action=author': {
    write: false,
    machineId: 'required',
    timeoutMs: READ_TIMEOUT_MS,
  },
  'reviews?action=spin': {
    write: true,
    machineId: 'required',
    timeoutMs: READ_TIMEOUT_MS,
  },
  'reviews?action=claim': {
    write: true,
    machineId: 'required',
    timeoutMs: WRITE_TIMEOUT_MS,
  },
  'reviews?action=reply': {
    write: true,
    machineId: 'required',
    timeoutMs: WRITE_TIMEOUT_MS,
  },
  'reviews?action=edit': {
    write: true,
    machineId: 'required',
    timeoutMs: WRITE_TIMEOUT_MS,
  },
  'submit-feedback': { write: true, machineId: 'required', timeoutMs: WRITE_TIMEOUT_MS },
  'submit-feedback?action=upload-urls': {
    write: true,
    machineId: 'required',
    timeoutMs: READ_TIMEOUT_MS,
  },
  'get-feedback-replies': {
    write: false,
    machineId: 'required',
    timeoutMs: READ_TIMEOUT_MS,
  },
};

const successSchema = z.object({ success: z.literal(true) });

async function attempt<T>(
  endpoint: ReviewEndpoint,
  body: Record<string, unknown>,
  schema: z.ZodType<T>,
  { captchaToken, refuseWithoutToken, onServerTime }: ReviewCallOptions
): Promise<ReviewResult<T>> {
  try {
    const token = captchaToken ? await captchaToken() : undefined;
    if (token === null && refuseWithoutToken) {
      return { ok: false, failure: reviewFailure('captcha_unavailable', endpoint) };
    }
    const { data, error, response } = await getSupabaseClient().functions.invoke<unknown>(
      endpoint,
      {
        body: typeof token === 'string' ? { ...body, captchaToken: token } : body,
        timeout: ENDPOINTS[endpoint].timeoutMs,
      }
    );
    if (error) {
      const code = await failureCodeOf(error);
      // An enforced captcha refuses a write without a token, which only a working captcha page can fix
      const failure =
        token === null && code === 'captcha_failed' ? 'captcha_unavailable' : code;
      return { ok: false, failure: reviewFailure(failure, endpoint) };
    }
    const flagged = successSchema.safeParse(data);
    const parsed = flagged.success ? schema.safeParse(data) : flagged;
    if (!parsed.success) {
      // Issues name paths and expectations, never the values, so no user text reaches Sentry
      const detail = z.prettifyError(parsed.error);
      return { ok: false, failure: reviewFailure('bad_response', endpoint, detail) };
    }
    const serverTime = Date.parse(response?.headers.get('Date') ?? '');
    if (onServerTime && !Number.isNaN(serverTime)) {
      onServerTime(new Date(serverTime).toISOString());
    }
    return { ok: true, data: parsed.data };
  } catch (error) {
    console.error(`[Reviews] ${endpoint} threw:`, errorMessage(error));
    return { ok: false, failure: reviewFailure('unreachable', endpoint) };
  }
}

// Main alone adds the machine id, after the caller's fields, so nothing the renderer sends can replace it
export async function callReviewFunction<T>(
  endpoint: ReviewEndpoint,
  body: Record<string, unknown>,
  schema: z.ZodType<T>,
  options: ReviewCallOptions = {}
): Promise<ReviewResult<T>> {
  const rule = ENDPOINTS[endpoint];
  if (rule.write && IS_E2E) {
    return { ok: false, failure: reviewFailure('e2e_mode', endpoint) };
  }
  const machineId = getMachineId();
  if (!machineId && rule.machineId === 'required') {
    return { ok: false, failure: reviewFailure('no_machine_id', endpoint) };
  }
  const payload = machineId ? { ...body, machineId } : body;
  const first = await attempt(endpoint, payload, schema, options);
  // Siteverify spends a token even when it rejects it, so the one retry takes a fresh one
  if (!first.ok && first.failure.code === 'captcha_failed' && options.captchaToken) {
    const second = await attempt(endpoint, payload, schema, options);
    // Two fresh tokens refused points at a hostname, action or cData mismatch, not at the user
    if (!second.ok && second.failure.code === 'captcha_failed') {
      reportCaptchaFault('siteverify refused a fresh token');
    }
    return second;
  }
  return first;
}
