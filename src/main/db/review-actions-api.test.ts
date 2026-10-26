import { beforeEach, describe, expect, it, vi } from 'vitest';
import { answered, invokeCalls, MACHINE_ID } from './review-functions.fixture';

const { invoke } = vi.hoisted(() => ({ invoke: vi.fn() }));

vi.mock('@/main/db/supabase-client', () => ({
  getSupabaseClient: () => ({ functions: { invoke } }),
}));
vi.mock('@/main/tracking', () => ({ IS_E2E: false, getMachineId: () => 'machine-1' }));

const { editReviewEntry, replyToReview } = await import('./review-actions-api');

beforeEach(() => {
  invoke.mockReset();
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});

describe('replyToReview', () => {
  it('posts the reply under its client id and reads the outcome', async () => {
    invoke.mockResolvedValue(answered({ id: 'reply-1', outcome: 'pending' }));

    const result = await replyToReview({
      id: 'reply-1',
      reviewId: 'review-1',
      parentId: null,
      text: 'thanks',
    });

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
  });

  it('refuses an outcome the server never sends', async () => {
    invoke.mockResolvedValue(answered({ id: 'reply-1', outcome: 'approved' }));

    const result = await replyToReview({
      id: 'reply-1',
      reviewId: 'review-1',
      parentId: 'reply-0',
      text: 'thanks',
    });

    expect(result.ok ? null : result.failure.code).toBe('bad_response');
  });
});

describe('editReviewEntry', () => {
  it('sends only the entry id, the text and this machine', async () => {
    invoke.mockResolvedValue(answered({ id: 'entry-1', outcome: 'removed' }));

    const result = await editReviewEntry({ id: 'entry-1', text: 'better' });

    expect(result).toEqual({ ok: true, data: { id: 'entry-1', outcome: 'removed' } });
    expect(invokeCalls(invoke.mock.calls)[0]).toEqual({
      name: 'reviews?action=edit',
      body: { id: 'entry-1', text: 'better', machineId: MACHINE_ID },
      timeout: 30_000,
    });
  });
});
