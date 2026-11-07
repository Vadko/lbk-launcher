import {
  FunctionsFetchError,
  FunctionsHttpError,
  FunctionsRelayError,
} from '@supabase/supabase-js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import type { ReviewFailureKind } from '../../shared/game-reviews-api-types';
import { answered, type Invoke, MACHINE_ID, refused } from './review-functions.fixture';

const state = vi.hoisted(() => ({
  invoke: vi.fn<Invoke>(),
  machineId: 'machine-1' as string | null,
  e2e: false,
  clientThrows: false,
}));

vi.mock('@/main/db/supabase-client', () => ({
  getSupabaseClient: () => {
    if (state.clientThrows) {
      throw new Error('Missing Supabase credentials');
    }
    return { functions: { invoke: state.invoke } };
  },
}));
vi.mock('@/main/tracking', () => ({
  get IS_E2E() {
    return state.e2e;
  },
  getMachineId: () => state.machineId,
}));
const { callReviewFunction } = await import('./review-request');

const okSchema = z.object({ id: z.string() });

const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);

const reply = (captchaToken?: () => Promise<string | null>) =>
  callReviewFunction(
    'reviews?action=reply',
    { id: 'r1', text: 'hi' },
    okSchema,
    captchaToken
  );

const calls = () => state.invoke.mock.calls;

beforeEach(() => {
  state.invoke.mockReset();
  state.machineId = MACHINE_ID;
  state.e2e = false;
  state.clientThrows = false;
  warn.mockClear();
  error.mockClear();
});

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe('callReviewFunction', () => {
  it('returns the parsed answer and adds the machine id last', async () => {
    state.invoke.mockResolvedValue(answered({ id: 'r1', extra: true }));

    const result = await callReviewFunction(
      'reviews?action=reply',
      { id: 'r1', machineId: 'someone-else' },
      okSchema
    );

    expect(result).toEqual({ ok: true, data: { id: 'r1' } });
    expect(calls()).toEqual([
      [
        'reviews?action=reply',
        { body: { id: 'r1', machineId: MACHINE_ID }, timeout: 30_000 },
      ],
    ]);
  });

  it('gives reads the shorter timeout', async () => {
    state.invoke.mockResolvedValue(answered({ id: 'x' }));

    await callReviewFunction('reviews?action=list', { gameId: 'g' }, okSchema);

    expect(calls()[0]?.[1].timeout).toBe(15_000);
  });

  it.each([
    ['invalid_body', 400, 'rejected', 'error'],
    ['invalid_hold', 400, 'rejected', 'warn'],
    ['invalid_candidate', 400, 'rejected', 'warn'],
    ['captcha_failed', 403, 'retry', 'warn'],
    ['edit_window_closed', 403, 'rejected', 'warn'],
    ['not_owner', 403, 'rejected', 'warn'],
    ['banned', 403, 'rejected', 'warn'],
    ['edit_limit_reached', 403, 'rejected', 'warn'],
    ['thread_full', 403, 'rejected', 'warn'],
    ['not_found', 404, 'rejected', 'warn'],
    ['method_not_allowed', 405, 'rejected', 'error'],
    ['id_conflict', 409, 'rejected', 'warn'],
    ['nickname_taken', 409, 'rejected', 'warn'],
    ['author_exists', 409, 'rejected', 'warn'],
    ['not_moderated', 409, 'rejected', 'error'],
    ['author_required', 412, 'needs-author', 'warn'],
    ['rate_limit', 429, 'retry', 'warn'],
    ['daily_limit', 429, 'retry', 'warn'],
    ['internal', 500, 'retry', 'error'],
    ['captcha_unavailable', 503, 'retry', 'warn'],
    ['nicknames_exhausted', 503, 'retry', 'warn'],
  ] as const)(
    '%s (%i) is a %s failure logged as %s',
    async (code, status, kind: ReviewFailureKind, level) => {
      state.invoke.mockResolvedValue(refused(code, status));

      expect(await reply()).toEqual({ ok: false, failure: { code, kind } });
      expect((level === 'warn' ? warn : error).mock.calls).toEqual([
        [`[Reviews] reviews?action=reply failed: ${code}`],
      ]);
      expect((level === 'warn' ? error : warn).mock.calls).toEqual([]);
    }
  );

  it.each([
    [
      'a gateway 502 page',
      new Response('<html>Bad gateway</html>', { status: 502 }),
      { code: 'unreachable', kind: 'retry' },
    ],
    [
      'a gateway 429',
      new Response('{"msg":"slow down"}', { status: 429 }),
      { code: 'rate_limit', kind: 'retry' },
    ],
    [
      'a gateway 408',
      new Response('Request timeout', { status: 408 }),
      { code: 'unreachable', kind: 'retry' },
    ],
    [
      'a missing function',
      new Response('Not found', { status: 404 }),
      { code: 'gateway_refused', kind: 'rejected' },
    ],
    [
      'an unknown code',
      new Response('{"success":false,"error":"new_code"}', { status: 400 }),
      { code: 'refused', kind: 'rejected' },
    ],
  ])('classifies %s by its status', async (_label, response, failure) => {
    state.invoke.mockResolvedValue({
      data: null,
      error: new FunctionsHttpError(response),
    });

    expect(await reply()).toEqual({ ok: false, failure });
  });

  it.each([
    [
      'a code newer than this build as a warning',
      new Response('{"success":false,"error":"new_code"}', { status: 400 }),
      'warn',
      ['[Reviews] reviews?action=reply failed: refused', 'HTTP 400 new_code'],
    ],
    [
      "the gateway's own 4xx as an error",
      new Response('Not found', { status: 404 }),
      'error',
      ['[Reviews] reviews?action=reply failed: gateway_refused', 'HTTP 404'],
    ],
  ] as const)('logs %s', async (_label, response, level, line) => {
    state.invoke.mockResolvedValue({
      data: null,
      error: new FunctionsHttpError(response),
    });

    await reply();

    expect({ warn: warn.mock.calls, error: error.mock.calls }).toEqual({
      warn: level === 'warn' ? [line] : [],
      error: level === 'error' ? [line] : [],
    });
  });

  it.each([
    ['a 4xx', 409, { code: 'gateway_refused', kind: 'rejected' }],
    ['a 5xx', 503, { code: 'unreachable', kind: 'retry' }],
  ])('stops waiting for the stalled body of %s', async (_label, status, failure) => {
    vi.useFakeTimers();
    const stalled = new ReadableStream({ start: () => undefined });
    state.invoke.mockResolvedValue({
      data: null,
      error: new FunctionsHttpError(new Response(stalled, { status })),
    });

    const result = reply();
    await vi.advanceTimersByTimeAsync(5_000);

    await expect(result).resolves.toEqual({ ok: false, failure });
  });

  it.each([
    ['offline or timed out', new FunctionsFetchError(new TypeError('fetch failed'))],
    ['a relay error', new FunctionsRelayError(new Response(null, { status: 502 }))],
  ])('treats %s as unreachable and retryable', async (_label, failure) => {
    state.invoke.mockResolvedValue({ data: null, error: failure });

    expect(await reply()).toEqual({
      ok: false,
      failure: { code: 'unreachable', kind: 'retry' },
    });
    expect(error).not.toHaveBeenCalled();
  });

  it('reports a 2xx body against the schema as a bad response', async () => {
    state.invoke.mockResolvedValue({ data: { success: true, id: 42 }, error: null });

    expect(await reply()).toEqual({
      ok: false,
      failure: { code: 'bad_response', kind: 'retry' },
    });
    expect(error).toHaveBeenCalledWith(
      '[Reviews] reviews?action=reply failed: bad_response',
      expect.stringContaining('✖')
    );
  });

  it('logs where a 2xx body broke the schema, without its values', async () => {
    state.invoke.mockResolvedValue({ data: { success: true, id: 42 }, error: null });

    await reply();

    const detail = String(error.mock.calls[0]?.[1]);
    expect(detail).toContain('id');
    expect(detail).not.toContain('42');
  });

  it('turns a throw into a retryable failure', async () => {
    state.clientThrows = true;

    expect(await reply()).toEqual({
      ok: false,
      failure: { code: 'unreachable', kind: 'retry' },
    });
    expect(error).toHaveBeenCalledWith(
      '[Reviews] reviews?action=reply threw:',
      'Missing Supabase credentials'
    );
  });

  it('leaves a missing machine id out of the body', async () => {
    state.machineId = null;
    state.invoke.mockResolvedValue(answered({ id: 'x' }));

    await callReviewFunction('reviews?action=list', { gameId: 'g' }, okSchema);

    expect(calls()[0]?.[1].body).toEqual({ gameId: 'g' });
  });

  describe('in an E2E run', () => {
    beforeEach(() => {
      state.e2e = true;
    });

    it('sends no write', async () => {
      expect(await reply()).toEqual({
        ok: false,
        failure: { code: 'e2e_mode', kind: 'rejected' },
      });
      expect(state.invoke).not.toHaveBeenCalled();
    });

    it('still reads', async () => {
      state.invoke.mockResolvedValue(answered({ id: 'x' }));

      expect((await callReviewFunction('reviews?action=list', {}, okSchema)).ok).toBe(
        true
      );
    });
  });

  describe('with a captcha source', () => {
    it('sends a token with the request', async () => {
      state.invoke.mockResolvedValue(answered({ id: 'r1' }));

      await reply(() => Promise.resolve('token-1'));

      expect(calls()[0]?.[1].body).toEqual({
        id: 'r1',
        text: 'hi',
        machineId: MACHINE_ID,
        captchaToken: 'token-1',
      });
    });

    it('leaves a write without a token to the server, which may have the captcha off', async () => {
      state.invoke.mockResolvedValue(answered({ id: 'r1' }));

      const result = await reply(() => Promise.resolve(null));

      expect(result).toEqual({ ok: true, data: { id: 'r1' } });
      expect(calls().map(([, { body }]) => body)).toEqual([
        { id: 'r1', text: 'hi', machineId: MACHINE_ID },
      ]);
    });
  });
});
