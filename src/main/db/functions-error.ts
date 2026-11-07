import { FunctionsHttpError } from '@supabase/supabase-js';
import pTimeout from 'p-timeout';

// functions-js clears its timeout before it hands back the error, so only undici's 300 s would end a stalled body
const BODY_TIMEOUT_MS = 5_000;

/**
 * Helpers for working with supabase Edge Function errors.
 *
 * supabase.functions.invoke() throws a FunctionsHttpError on non-2xx, whose
 * `context` is the raw Response. There is no built-in way to get the
 * status/body, so we read them ourselves.
 */

/** HTTP status from an edge function error (for 4xx branches), or undefined. */
export function functionsErrorStatus(error: unknown): number | undefined {
  return error instanceof FunctionsHttpError
    ? (error.context as Response).status
    : undefined;
}

/**
 * Read the status + JSON body from an edge function error (e.g. rate-limit
 * details on 429). Returns null if this isn't an HTTP function error.
 */
export async function readFunctionsErrorBody(
  error: unknown
): Promise<{ status: number; body: Record<string, unknown> } | null> {
  if (!(error instanceof FunctionsHttpError)) {
    return null;
  }
  const response = error.context as Response;
  const body: Record<string, unknown> = await pTimeout(response.json(), {
    milliseconds: BODY_TIMEOUT_MS,
    fallback: () => ({}),
  }).catch(() => ({}));
  return { status: response.status, body };
}
