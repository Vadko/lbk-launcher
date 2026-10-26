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
vi.mock('@/main/turnstile/tokens', () => ({ takeCaptchaToken }));

const { claimReviewNickname, getReviewAuthor, spinReviewNickname } = await import(
  './review-author-api'
);

const AUTHOR = { name: 'Quiet Owl', avatarSeed: 'abcdef123456' };
const SPIN = '6c1f1d0e-7a2b-4c3d-8e9f-0a1b2c3d4e5f';

beforeEach(() => {
  invoke.mockReset();
  takeCaptchaToken.mockReset();
  takeCaptchaToken.mockResolvedValue('token-1');
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});

describe('getReviewAuthor', () => {
  it.each([
    ['no author yet', null],
    ['a claimed author', AUTHOR],
  ])('reads %s with the spins left', async (_label, author) => {
    invoke.mockResolvedValue(answered({ author, spinsLeft: 59 }));

    expect(await getReviewAuthor()).toEqual({
      ok: true,
      data: { author, spinsLeft: 59 },
    });
    expect(invokeCalls(invoke.mock.calls)[0]?.body).toEqual({ machineId: MACHINE_ID });
  });
});

describe('spinReviewNickname', () => {
  it('sends exactly the three holds and reads the deal', async () => {
    const deal = {
      spinId: SPIN,
      avatarSeed: 'abcdef123456',
      adjective: 'Quiet',
      noun: 'Owl',
      name: 'Quiet Owl',
      decoys: { avatarSeeds: ['a'], adjectives: ['b'], nouns: ['c'] },
      spinsLeft: 58,
    };
    invoke.mockResolvedValue(answered(deal));
    const hold = { avatar: true, adjective: false, noun: false, extra: true };

    expect(await spinReviewNickname({ spinId: SPIN, hold })).toEqual({
      ok: true,
      data: deal,
    });
    expect(invokeCalls(invoke.mock.calls)[0]).toEqual({
      name: 'reviews?action=spin',
      body: {
        spinId: SPIN,
        hold: { avatar: true, adjective: false, noun: false },
        machineId: MACHINE_ID,
      },
      timeout: 15_000,
    });
  });

  it('reports an author claimed elsewhere as author_exists', async () => {
    invoke.mockResolvedValue(refused('author_exists', 409));

    expect(
      await spinReviewNickname({
        spinId: null,
        hold: { avatar: false, adjective: false, noun: false },
      })
    ).toEqual({ ok: false, failure: { code: 'author_exists', kind: 'rejected' } });
  });
});

describe('claimReviewNickname', () => {
  it('returns the claimed author, claimed with a nickname token', async () => {
    invoke.mockResolvedValue(answered({ author: AUTHOR }));

    expect(await claimReviewNickname({ spinId: SPIN })).toEqual({
      ok: true,
      data: AUTHOR,
    });
    expect(takeCaptchaToken).toHaveBeenCalledWith('nickname');
    expect(invokeCalls(invoke.mock.calls)[0]).toEqual({
      name: 'reviews?action=claim',
      body: { spinId: SPIN, machineId: MACHINE_ID, captchaToken: 'token-1' },
      timeout: 30_000,
    });
  });

  it('leaves a claim without a token to the server', async () => {
    takeCaptchaToken.mockResolvedValue(null);
    invoke.mockResolvedValue(answered({ author: AUTHOR }));

    expect(await claimReviewNickname({ spinId: SPIN })).toEqual({
      ok: true,
      data: AUTHOR,
    });
    expect(invokeCalls(invoke.mock.calls)[0]?.body).toEqual({
      spinId: SPIN,
      machineId: MACHINE_ID,
    });
  });
});
