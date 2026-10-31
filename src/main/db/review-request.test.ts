import {
  FunctionsFetchError,
  FunctionsHttpError,
  FunctionsRelayError,
} from '@supabase/supabase-js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import type { ReviewFailureKind } from '../../shared/game-reviews-api-types';
import { answered, invokeCalls, MACHINE_ID, refused } from './review-functions.fixture';

const state = vi.hoisted(() => ({
  invoke: vi.fn(),
  machineId: 'machine-1' as string | null,
  e2e: false,
  clientThrows: false,
  reportCaptchaFault: vi.fn(),
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
vi.mock('@/main/turnstile/report-captcha-fault', () => ({
  reportCaptchaFault: state.reportCaptchaFault,
}));

const { callReviewFunction } = await import('./review-request');

const okSchema = z.object({ id: z.string() });

const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);

const reply = (options?: Parameters<typeof callReviewFunction>[3]) =>
  callReviewFunction('reviews?action=reply', { id: 'r1', text: 'hi' }, okSchema, options);

const calls = () => invokeCalls(state.invoke.mock.calls);

beforeEach(() => {
  state.invoke.mockReset();
  state.machineId = MACHINE_ID;
  state.e2e = false;
  state.clientThrows = false;
  warn.mockClear();
  error.mockClear();
});

afterEach(() => {
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
      {
        name: 'reviews?action=reply',
        body: { id: 'r1', machineId: MACHINE_ID },
        timeout: 30_000,
      },
    ]);
  });

  it('reports the Date header of a 2xx answer only', async () => {
    const onServerTime = vi.fn();
    const headers = { Date: 'Thu, 29 Oct 2026 10:00:00 GMT' };
    state.invoke
      .mockResolvedValueOnce({
        ...answered({ id: 'r1' }),
        response: new Response(null, { headers }),
      })
      .mockResolvedValueOnce({
        ...refused('not_owner', 403),
        response: new Response(null, { status: 403, headers }),
      })
      .mockResolvedValueOnce(answered({ id: 'r1' }));

    await reply({ onServerTime });
    await reply({ onServerTime });
    await reply({ onServerTime });

    expect(onServerTime.mock.calls).toEqual([['2026-10-29T10:00:00.000Z']]);
  });

  it('gives reads the shorter timeout', async () => {
    state.invoke.mockResolvedValue(answered({ id: 'x' }));

    await callReviewFunction('reviews?action=list', { gameId: 'g' }, okSchema);

    expect(calls()[0]?.timeout).toBe(15_000);
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
      'unreachable',
    ],
    ['a gateway 429', new Response('{"msg":"slow down"}', { status: 429 }), 'rate_limit'],
    ['a missing function', new Response('Not found', { status: 404 }), 'bad_response'],
    [
      'an unknown code',
      new Response('{"success":false,"error":"new_code"}', { status: 400 }),
      'bad_response',
    ],
  ])('classifies %s by its status', async (_label, response, code) => {
    state.invoke.mockResolvedValue({
      data: null,
      error: new FunctionsHttpError(response),
    });

    const result = await reply();

    expect(result.ok ? null : result.failure.code).toBe(code);
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

  it.each([
    ['without success', { id: 'r1' }],
    ['with success false', { success: false, id: 'r1' }],
    ['against the schema', { success: true, id: 42 }],
  ])('reports a 2xx body %s as a bad response', async (_label, data) => {
    state.invoke.mockResolvedValue({ data, error: null });

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

  describe('without a machine id', () => {
    beforeEach(() => {
      state.machineId = null;
    });

    it('still reads the list, without the id', async () => {
      state.invoke.mockResolvedValue(answered({ id: 'x' }));

      await callReviewFunction('reviews?action=list', { gameId: 'g' }, okSchema);

      expect(calls()[0]?.body).toEqual({ gameId: 'g' });
    });

    it('sends no write', async () => {
      expect(await reply()).toEqual({
        ok: false,
        failure: { code: 'no_machine_id', kind: 'rejected' },
      });
      expect(state.invoke).not.toHaveBeenCalled();
    });
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

      await reply({ captchaToken: () => Promise.resolve('token-1') });

      expect(calls()[0]?.body).toEqual({
        id: 'r1',
        text: 'hi',
        machineId: MACHINE_ID,
        captchaToken: 'token-1',
      });
    });

    it('retries a rejected token once with a fresh one', async () => {
      const tokens = ['token-1', 'token-2', 'token-3'];
      const captchaToken = vi.fn(() => Promise.resolve(tokens.shift() ?? null));
      // A Response body reads once, so every attempt gets its own
      state.invoke.mockImplementation(() =>
        Promise.resolve(refused('captcha_failed', 403))
      );

      const result = await reply({ captchaToken });

      expect(result).toEqual({
        ok: false,
        failure: { code: 'captcha_failed', kind: 'retry' },
      });
      expect(calls().map((call) => call.body['captchaToken'])).toEqual([
        'token-1',
        'token-2',
      ]);
      expect(state.reportCaptchaFault).toHaveBeenCalledWith(
        'siteverify refused a fresh token'
      );
    });

    it('settles on the retry when the fresh token passes', async () => {
      state.invoke
        .mockResolvedValueOnce(refused('captcha_failed', 403))
        .mockResolvedValueOnce(answered({ id: 'r1' }));

      const result = await reply({ captchaToken: () => Promise.resolve('token') });

      expect(result).toEqual({ ok: true, data: { id: 'r1' } });
      expect(state.reportCaptchaFault).not.toHaveBeenCalled();
    });

    it('does not retry other refusals', async () => {
      state.invoke.mockResolvedValue(refused('rate_limit', 429));

      await reply({ captchaToken: () => Promise.resolve('token') });

      expect(state.invoke).toHaveBeenCalledTimes(1);
    });

    it('leaves a write without a token to the server, which may have the captcha off', async () => {
      state.invoke.mockResolvedValue(answered({ id: 'r1' }));

      const result = await reply({ captchaToken: () => Promise.resolve(null) });

      expect(result).toEqual({ ok: true, data: { id: 'r1' } });
      expect(calls().map((call) => call.body)).toEqual([
        { id: 'r1', text: 'hi', machineId: MACHINE_ID },
      ]);
    });

    it('reads a refused write without a token as captcha_unavailable, never retried', async () => {
      state.invoke.mockResolvedValue(refused('captcha_failed', 403));

      expect(await reply({ captchaToken: () => Promise.resolve(null) })).toEqual({
        ok: false,
        failure: { code: 'captcha_unavailable', kind: 'retry' },
      });
      expect(state.invoke).toHaveBeenCalledTimes(1);
    });

    it('sends nothing without a token when the call refuses that', async () => {
      const result = await reply({
        captchaToken: () => Promise.resolve(null),
        refuseWithoutToken: true,
      });

      expect(result).toEqual({
        ok: false,
        failure: { code: 'captcha_unavailable', kind: 'retry' },
      });
      expect(state.invoke).not.toHaveBeenCalled();
    });
  });

  it('never retries captcha_failed without a source', async () => {
    state.invoke.mockResolvedValue(refused('captcha_failed', 403));

    await reply();

    expect(state.invoke).toHaveBeenCalledTimes(1);
  });
});
