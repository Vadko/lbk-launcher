import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { type Actor, createActor, fromPromise } from 'xstate';
import type {
  NicknameClaimInput,
  NicknameSpin,
  NicknameSpinInput,
  ReviewAuthorState,
  ReviewFailure,
  ReviewResult,
} from '@/shared/game-reviews-api-types';
import type { ReviewAuthorIdentity } from '@/shared/game-reviews-types';
import { reviewAuthorPickerMachine } from './reviewAuthorPickerMachine';
import { ALL_REELS, NO_REELS, type ReelFlags } from './slotReels';

const OWL: ReviewAuthorIdentity = { name: 'Quiet Owl', avatarSeed: '0a1b2c3d4e5f' };

let spinCount = 0;
const dealt = (): NicknameSpin => {
  spinCount += 1;
  return {
    spinId: `00000000-0000-4000-8000-${String(spinCount).padStart(12, '0')}`,
    avatarSeed: `seed${spinCount}`,
    adjective: `Adj${spinCount}`,
    noun: `Noun${spinCount}`,
    name: `Adj${spinCount} Noun${spinCount}`,
    decoys: { avatarSeeds: ['d1', 'd2'], adjectives: ['A1', 'A2'], nouns: ['N1', 'N2'] },
    spinsLeft: 59,
  };
};

const ok = <T>(data: T): ReviewResult<T> => ({ ok: true, data });
const fail = <T>(code: ReviewFailure['code']): ReviewResult<T> => ({
  ok: false,
  failure: { code, kind: 'rejected' },
});

let actor: Actor<typeof reviewAuthorPickerMachine> | null = null;

interface StartOptions {
  spin?: NicknameSpin | null;
  animate?: boolean;
  // The answer to the spin the picker makes on open
  firstSpin?: ReviewResult<NicknameSpin>;
  spinsLeft?: number | null;
}

function start({
  spin = null,
  animate = true,
  firstSpin,
  spinsLeft = null,
}: StartOptions = {}) {
  const spinCalls = vi.fn((_input: NicknameSpinInput) =>
    Promise.resolve<ReviewResult<NicknameSpin>>(ok(dealt()))
  );
  if (firstSpin) {
    spinCalls.mockResolvedValueOnce(firstSpin);
  }
  const claimCalls = vi.fn((_input: NicknameClaimInput) =>
    Promise.resolve<ReviewResult<ReviewAuthorIdentity>>(ok(OWL))
  );
  const authorCalls = vi.fn(() =>
    Promise.resolve<ReviewResult<ReviewAuthorState>>(ok({ author: OWL, spinsLeft: 60 }))
  );
  const machine = createActor(
    reviewAuthorPickerMachine.provide({
      actors: {
        spin: fromPromise(({ input }) => spinCalls(input)),
        claim: fromPromise(({ input }) => claimCalls(input)),
        author: fromPromise(() => authorCalls()),
      },
    }),
    { input: { spin, animate, spinsLeft } }
  ).start();
  actor = machine;
  return { actor: machine, spinCalls, claimCalls, authorCalls };
}

type Harness = ReturnType<typeof start>;

const state = (h: Harness) => h.actor.getSnapshot().value;
const context = (h: Harness) => h.actor.getSnapshot().context;
const flush = () => vi.advanceTimersByTimeAsync(0);
const land = () => vi.advanceTimersByTimeAsync(2050);

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  actor?.stop();
  actor = null;
  vi.useRealTimers();
});

describe('reviewAuthorPickerMachine', () => {
  it('spins on open and stops the reels in order', async () => {
    const h = start();
    expect(state(h)).toBe('spinning');
    expect(context(h).moving).toEqual({ avatar: true, adjective: true, noun: true });

    await flush();
    expect(state(h)).toBe('landing');
    await vi.advanceTimersByTimeAsync(790);
    expect(context(h).moving).toEqual({ avatar: false, adjective: true, noun: true });
    await vi.advanceTimersByTimeAsync(400);
    expect(context(h).moving).toEqual({ avatar: false, adjective: false, noun: true });
    await vi.advanceTimersByTimeAsync(400);
    expect(context(h).moving).toEqual(NO_REELS);
    expect(state(h)).toBe('landing');
    await vi.advanceTimersByTimeAsync(460);
    expect(state(h)).toBe('idle');
  });

  it('lands at once with animations off', async () => {
    const h = start({ animate: false });
    await flush();

    expect(state(h)).toBe('idle');
    expect(context(h).moving).toEqual(NO_REELS);
  });

  it('shows a spin kept from an earlier open without spending a new one', () => {
    const kept = dealt();
    const h = start({ spin: kept });

    expect(state(h)).toBe('idle');
    expect(context(h).spin).toBe(kept);
    expect(h.spinCalls).not.toHaveBeenCalled();
  });

  it('sends the held reels with the spin they keep and leaves them still', async () => {
    const h = start();
    await flush();
    await land();
    const first = context(h).spin;

    h.actor.send({ type: 'TOGGLE_HOLD', reel: 'noun' });
    h.actor.send({ type: 'TOGGLE_HOLD', reel: 'avatar' });
    h.actor.send({ type: 'TOGGLE_HOLD', reel: 'avatar' });
    h.actor.send({ type: 'PULL' });

    expect(h.spinCalls).toHaveBeenLastCalledWith({
      spinId: first?.spinId,
      hold: { avatar: false, adjective: false, noun: true },
    });
    expect(context(h).moving).toEqual({ avatar: true, adjective: true, noun: false });
    await flush();
    await land();
    expect(context(h).holds).toEqual({ avatar: false, adjective: false, noun: true });
  });

  it('holds all three reels but takes no pull until one is let go', async () => {
    const h = start();
    await flush();
    await land();
    const first = context(h).spin;

    for (const reel of ['avatar', 'adjective', 'noun'] as const) {
      h.actor.send({ type: 'TOGGLE_HOLD', reel });
    }
    expect(context(h).holds).toEqual(ALL_REELS);
    h.actor.send({ type: 'PULL' });
    expect(state(h)).toBe('idle');
    expect(h.spinCalls).toHaveBeenCalledTimes(1);

    h.actor.send({ type: 'TOGGLE_HOLD', reel: 'adjective' });
    h.actor.send({ type: 'PULL' });
    expect(h.spinCalls).toHaveBeenLastCalledWith({
      spinId: first?.spinId,
      hold: { avatar: true, adjective: false, noun: true },
    });
  });

  it('shows the held reels from the previous spin until the pull lands', async () => {
    const h = start();
    await flush();
    await land();
    const first = context(h).spin;
    h.actor.send({ type: 'TOGGLE_HOLD', reel: 'adjective' });

    h.actor.send({ type: 'PULL' });
    await flush();
    expect(state(h)).toBe('landing');
    expect(context(h).heldSpin).toBe(first);

    await land();
    expect(state(h)).toBe('idle');
    expect(context(h).heldSpin).toBeNull();
  });

  it('ignores holds, pulls and claims while the reels move', async () => {
    const h = start();
    h.actor.send({ type: 'TOGGLE_HOLD', reel: 'noun' });
    h.actor.send({ type: 'CLAIM' });
    await flush();
    h.actor.send({ type: 'PULL' });

    expect(context(h).holds).toEqual(NO_REELS);
    expect(h.spinCalls).toHaveBeenCalledTimes(1);
    expect(h.claimCalls).not.toHaveBeenCalled();
  });

  it('claims the shown spin and ends with the author', async () => {
    const h = start({ animate: false });
    await flush();
    const shown = context(h).spin;

    h.actor.send({ type: 'CLAIM' });
    await flush();

    expect(h.claimCalls).toHaveBeenCalledWith({ spinId: shown?.spinId });
    expect(h.actor.getSnapshot().status).toBe('done');
    expect(h.actor.getSnapshot().output).toEqual(OWL);
    expect(context(h).won).toBe(true);
  });

  it.each<[string, ReelFlags]>([
    ['the avatar and the noun', { avatar: true, adjective: false, noun: true }],
    ['both words', { avatar: false, adjective: true, noun: true }],
    ['all three reels', ALL_REELS],
  ])(
    'spins again on a taken name held with %s, keeping only the noun',
    async (_held, holds) => {
      const h = start({ animate: false });
      await flush();
      for (const reel of ['avatar', 'adjective', 'noun'] as const) {
        if (holds[reel]) {
          h.actor.send({ type: 'TOGGLE_HOLD', reel });
        }
      }
      expect(context(h).holds).toEqual(holds);
      const taken = context(h).spin;
      h.claimCalls.mockResolvedValueOnce(fail('nickname_taken'));

      h.actor.send({ type: 'CLAIM' });
      await flush();

      expect(h.spinCalls).toHaveBeenLastCalledWith({
        spinId: taken?.spinId,
        hold: { avatar: false, adjective: false, noun: true },
      });
      expect(state(h)).toBe('idle');
      expect(context(h).notice).toBe('nameTaken');
      expect(context(h).spin?.spinId).not.toBe(taken?.spinId);
    }
  );

  it('spins again without holds when the name can no longer be claimed', async () => {
    const h = start({ animate: false });
    await flush();
    h.actor.send({ type: 'TOGGLE_HOLD', reel: 'adjective' });
    h.claimCalls.mockResolvedValueOnce(fail('invalid_candidate'));

    h.actor.send({ type: 'CLAIM' });
    await flush();

    expect(h.spinCalls.mock.lastCall?.[0].hold).toEqual(NO_REELS);
    expect(context(h).notice).toBe('nameExpired');
    h.actor.send({ type: 'CLAIM' });
    expect(state(h)).toBe('claiming');
  });

  it('respins without holds once when the held spin is no longer the latest', async () => {
    const h = start({ animate: false });
    await flush();
    h.actor.send({ type: 'TOGGLE_HOLD', reel: 'noun' });
    h.spinCalls.mockResolvedValueOnce(fail('invalid_hold'));

    h.actor.send({ type: 'PULL' });
    await flush();

    expect(h.spinCalls).toHaveBeenCalledTimes(3);
    expect(h.spinCalls.mock.lastCall?.[0].hold).toEqual(NO_REELS);
    expect(state(h)).toBe('idle');
    expect(context(h).notice).toBe('holdsReleased');
  });

  it('releases the held words when no free name is left with them', async () => {
    const h = start({ animate: false });
    await flush();
    h.actor.send({ type: 'TOGGLE_HOLD', reel: 'avatar' });
    h.actor.send({ type: 'TOGGLE_HOLD', reel: 'noun' });
    h.spinCalls.mockResolvedValueOnce(fail('nicknames_exhausted'));

    h.actor.send({ type: 'PULL' });
    await flush();

    expect(h.spinCalls.mock.lastCall?.[0].hold).toEqual({ ...NO_REELS, avatar: true });
    expect(context(h).notice).toBe('wordsReleased');
  });

  it('takes the existing author when the machine already has a nickname', async () => {
    const h = start({ firstSpin: fail('author_exists') });
    await flush();

    expect(h.authorCalls).toHaveBeenCalledTimes(1);
    expect(h.actor.getSnapshot().output).toEqual(OWL);
    expect(context(h).won).toBe(false);
  });

  it('takes the existing author over a claim, without winning the dealt name', async () => {
    const h = start({ animate: false });
    await flush();
    h.claimCalls.mockResolvedValueOnce(fail('author_exists'));

    h.actor.send({ type: 'CLAIM' });
    await flush();

    expect(h.actor.getSnapshot().status).toBe('done');
    expect(h.actor.getSnapshot().output).toEqual(OWL);
    expect(context(h).won).toBe(false);
  });

  it.each([
    ['rate_limit', 'rateLimit'],
    ['captcha_failed', 'captchaFailed'],
    ['captcha_unavailable', 'captchaUnavailable'],
    ['unreachable', 'offline'],
  ] as const)('keeps the candidate after a claim fails with %s', async (code, notice) => {
    const h = start({ animate: false });
    await flush();
    const shown = context(h).spin;
    h.claimCalls.mockResolvedValueOnce(fail(code));

    h.actor.send({ type: 'CLAIM' });
    await flush();

    expect(state(h)).toBe('idle');
    expect(context(h).notice).toBe(notice);
    expect(context(h).spin).toBe(shown);
    expect(h.spinCalls).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['rate_limit', 'rateLimit', { ...NO_REELS, noun: true }],
    ['unreachable', 'offline', NO_REELS],
    ['internal', 'failed', NO_REELS],
  ] as const)('reports a spin failing with %s', async (code, notice, holds) => {
    const h = start({ animate: false });
    await flush();
    h.actor.send({ type: 'TOGGLE_HOLD', reel: 'noun' });
    h.spinCalls.mockResolvedValueOnce(fail(code));

    h.actor.send({ type: 'PULL' });
    await flush();

    expect(state(h)).toBe('idle');
    expect(context(h)).toMatchObject({ notice, holds, moving: NO_REELS });
  });

  it('clears the notice on the next pull', async () => {
    const h = start({ animate: false, firstSpin: fail('unreachable') });
    await flush();
    expect(context(h).notice).toBe('offline');

    h.actor.send({ type: 'PULL' });
    expect(context(h).notice).toBeNull();
  });

  describe('out of spins', () => {
    it('opens on the notice without starting the reels', () => {
      const h = start({ spinsLeft: 0 });

      expect(state(h)).toBe('idle');
      expect(context(h).notice).toBe('rateLimit');
      expect(context(h).moving).toEqual(NO_REELS);
      expect(h.spinCalls).not.toHaveBeenCalled();
    });

    it('still shows a kept spin, which stays claimable', () => {
      const kept = dealt();
      const h = start({ spin: kept, spinsLeft: 0 });

      expect(state(h)).toBe('idle');
      expect(context(h).spin).toBe(kept);
      h.actor.send({ type: 'CLAIM' });
      expect(state(h)).toBe('claiming');
    });

    it('locks after the spin that spent the last one', async () => {
      const h = start({ animate: false, firstSpin: ok({ ...dealt(), spinsLeft: 0 }) });
      await flush();
      expect(context(h).spinsLeft).toBe(0);

      h.actor.send({ type: 'PULL' });

      expect(state(h)).toBe('idle');
      expect(context(h).notice).toBe('rateLimit');
      expect(h.spinCalls).toHaveBeenCalledTimes(1);
    });

    it('locks once the server refuses a spin for the limit', async () => {
      const h = start({ animate: false, firstSpin: fail('rate_limit') });
      await flush();

      h.actor.send({ type: 'PULL' });

      expect(context(h).moving).toEqual(NO_REELS);
      expect(h.spinCalls).toHaveBeenCalledTimes(1);
    });

    it('does not respin by itself when a claimed name was taken', async () => {
      const h = start({ animate: false, firstSpin: ok({ ...dealt(), spinsLeft: 0 }) });
      await flush();
      h.claimCalls.mockResolvedValueOnce(fail('nickname_taken'));

      h.actor.send({ type: 'CLAIM' });
      await flush();

      expect(state(h)).toBe('idle');
      expect(context(h).notice).toBe('rateLimit');
      expect(h.spinCalls).toHaveBeenCalledTimes(1);
    });

    it('takes no second claim of a name the first one turned down', async () => {
      const h = start({ animate: false, firstSpin: ok({ ...dealt(), spinsLeft: 0 }) });
      await flush();
      h.claimCalls.mockResolvedValueOnce(fail('invalid_candidate'));
      h.actor.send({ type: 'CLAIM' });
      await flush();

      h.actor.send({ type: 'CLAIM' });

      expect(state(h)).toBe('idle');
      expect(h.claimCalls).toHaveBeenCalledTimes(1);
    });
  });
});
