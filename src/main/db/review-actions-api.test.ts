import { beforeEach, describe, expect, it, vi } from 'vitest';
import { answered, invokeCalls, MACHINE_ID, refused } from './review-functions.fixture';

const { invoke, takeCaptchaToken } = vi.hoisted(() => ({
  invoke: vi.fn(),
  takeCaptchaToken: vi.fn(),
}));

vi.mock('@/main/db/supabase-client', () => ({
  getSupabaseClient: () => ({ functions: { invoke } }),
}));
vi.mock('@/main/tracking', () => ({ IS_E2E: false, getMachineId: () => 'machine-1' }));
vi.mock('@/main/turnstile/report-captcha-fault', () => ({ reportCaptchaFault: vi.fn() }));
vi.mock('@/main/turnstile/tokens', () => ({ takeCaptchaToken }));

const { editReviewEntry, replyToReview } = await import('./review-actions-api');

const reply = (isPublic: boolean, parentId: string | null = null) => ({
  id: 'reply-1',
  reviewId: 'review-1',
  parentId,
  text: 'thanks',
  isPublic,
});

const sentBodies = () => invokeCalls(invoke.mock.calls).map((call) => call.body);

beforeEach(() => {
  invoke.mockReset();
  takeCaptchaToken.mockReset();
  takeCaptchaToken.mockResolvedValue('token-1');
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});

describe('replyToReview', () => {
  it('posts the reply under its client id and reads the outcome', async () => {
    invoke.mockResolvedValue(answered({ id: 'reply-1', outcome: 'pending' }));

    const result = await replyToReview(reply(false));

    expect(result).toEqual({ ok: true, data: { id: 'reply-1', outcome: 'pending' } });
    expect(invokeCalls(invoke.mock.calls)).toEqual([
      {
        name: 'reviews?action=reply',
        body: {
          id: 'reply-1',
          reviewId: 'review-1',
          parentId: null,
          text: 'thanks',
          machineId: MACHINE_ID,
        },
        timeout: 30_000,
      },
    ]);
    expect(takeCaptchaToken).not.toHaveBeenCalled();
  });

  it('refuses an outcome the server never sends', async () => {
    invoke.mockResolvedValue(answered({ id: 'reply-1', outcome: 'approved' }));

    const result = await replyToReview(reply(false, 'reply-0'));

    expect(result.ok ? null : result.failure.code).toBe('bad_response');
  });

  it('adds a reply token in a public thread', async () => {
    invoke.mockResolvedValue(answered({ id: 'reply-1', outcome: 'published' }));

    await replyToReview(reply(true));

    expect(takeCaptchaToken).toHaveBeenCalledWith('reply');
    expect(sentBodies()[0]).toMatchObject({ captchaToken: 'token-1' });
    expect(sentBodies()[0]).not.toHaveProperty('isPublic');
  });

  it('retries a refused token once with a fresh one', async () => {
    takeCaptchaToken.mockResolvedValueOnce('token-1').mockResolvedValueOnce('token-2');
    invoke
      .mockResolvedValueOnce(refused('captcha_failed', 403))
      .mockResolvedValueOnce(answered({ id: 'reply-1', outcome: 'published' }));

    const result = await replyToReview(reply(true));

    expect(result.ok).toBe(true);
    expect(sentBodies().map((body) => body['captchaToken'])).toEqual([
      'token-1',
      'token-2',
    ]);
  });

  it('leaves a reply without a token to the server', async () => {
    takeCaptchaToken.mockResolvedValue(null);
    invoke.mockResolvedValue(refused('captcha_failed', 403));

    expect(await replyToReview(reply(true))).toEqual({
      ok: false,
      failure: { code: 'captcha_unavailable', kind: 'retry' },
    });
    expect(sentBodies()).toEqual([
      {
        id: 'reply-1',
        reviewId: 'review-1',
        parentId: null,
        text: 'thanks',
        machineId: MACHINE_ID,
      },
    ]);
  });
});

describe('editReviewEntry', () => {
  it('sends only the entry id, the text and this machine', async () => {
    invoke.mockResolvedValue(answered({ id: 'entry-1', outcome: 'removed' }));

    const result = await editReviewEntry({
      id: 'entry-1',
      text: 'better',
      isPublic: false,
    });

    expect(result).toEqual({ ok: true, data: { id: 'entry-1', outcome: 'removed' } });
    expect(invokeCalls(invoke.mock.calls)[0]).toEqual({
      name: 'reviews?action=edit',
      body: { id: 'entry-1', text: 'better', machineId: MACHINE_ID },
      timeout: 30_000,
    });
    expect(takeCaptchaToken).not.toHaveBeenCalled();
  });

  it('adds an edit token for a public entry', async () => {
    invoke.mockResolvedValue(answered({ id: 'entry-1', outcome: 'published' }));

    await editReviewEntry({ id: 'entry-1', text: 'better', isPublic: true });

    expect(takeCaptchaToken).toHaveBeenCalledWith('edit');
    expect(sentBodies()[0]).toEqual({
      id: 'entry-1',
      text: 'better',
      machineId: MACHINE_ID,
      captchaToken: 'token-1',
    });
  });
});
