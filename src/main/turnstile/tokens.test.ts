import { createHash } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TurnstileAction } from '../../shared/game-reviews-api-types';
import type * as Tokens from './tokens';
import type { CaptchaAnswer } from './window';

const PAGE = new URL('https://lbklauncher.com/captcha');

interface Solve {
  action: TurnstileAction;
  cData: string;
  settle: (answer: CaptchaAnswer | null) => void;
}

const state = vi.hoisted(() => ({
  e2e: false,
  url: null as URL | null,
  machineId: 'machine-1' as string | null,
  solves: [] as Solve[],
  solveCaptcha: vi.fn(),
  reportCaptchaFault: vi.fn(),
}));

vi.mock('@/main/tracking', () => ({
  get IS_E2E() {
    return state.e2e;
  },
  getMachineId: () => state.machineId,
}));
vi.mock('@/main/turnstile/page-url', () => ({ captchaPageUrl: () => state.url }));
vi.mock('@/main/turnstile/window', () => ({ solveCaptcha: state.solveCaptcha }));
vi.mock('@/main/turnstile/report-captcha-fault', () => ({
  reportCaptchaFault: state.reportCaptchaFault,
}));

const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

let tokens: typeof Tokens;

const flush = () => vi.advanceTimersByTimeAsync(0);

function lastSolve(): Solve {
  const solve = state.solves.at(-1);
  if (!solve) {
    throw new Error('the page was not asked to solve');
  }
  return solve;
}

function solve(token: string, request = lastSolve()): void {
  request.settle({ token });
}

function refuse(code: string, request = lastSolve()): void {
  request.settle({ error: code });
}

beforeEach(async () => {
  vi.useFakeTimers();
  Object.assign(state, { e2e: false, url: PAGE, machineId: 'machine-1', solves: [] });
  state.solveCaptcha.mockReset();
  state.reportCaptchaFault.mockReset();
  state.solveCaptcha.mockImplementation(
    (_url: URL, action: TurnstileAction, cData: string) =>
      new Promise<CaptchaAnswer | null>((settle) => {
        state.solves.push({ action, cData, settle });
      })
  );
  warn.mockClear();
  vi.resetModules();
  tokens = await import('./tokens');
});

afterEach(() => {
  vi.useRealTimers();
});

describe('takeCaptchaToken', () => {
  it("asks the page for the action with this machine's cData", async () => {
    const token = tokens.takeCaptchaToken('reply');
    await flush();
    solve('token-1');

    expect(await token).toBe('token-1');
    expect(state.solveCaptcha).toHaveBeenCalledWith(
      PAGE,
      'reply',
      createHash('sha256').update('machine-1').digest('hex').slice(0, 32)
    );
  });

  it('solves a new token for every write', async () => {
    const first = tokens.takeCaptchaToken('edit');
    await flush();
    solve('token-1');
    await first;
    const second = tokens.takeCaptchaToken('edit');
    await flush();
    solve('token-2');

    expect(await second).toBe('token-2');
    expect(state.solves).toHaveLength(2);
  });

  it('keeps concurrent requests apart', async () => {
    const reply = tokens.takeCaptchaToken('reply');
    const edit = tokens.takeCaptchaToken('edit');
    await flush();
    const [replySolve, editSolve] = state.solves;
    solve('edit-token', editSolve);
    solve('reply-token', replySolve);

    expect(await Promise.all([reply, edit])).toEqual(['reply-token', 'edit-token']);
  });

  it('gives up on a solve the page never answers in 30 s', async () => {
    const token = tokens.takeCaptchaToken('review');
    await flush();
    await vi.advanceTimersByTimeAsync(30_000);

    expect(await token).toBeNull();
    expect(warn).toHaveBeenCalledWith('[Turnstile] review: no token in 30000 ms');
    expect(state.reportCaptchaFault).toHaveBeenCalledWith('no token in time');
  });

  it('forgets a request once its deadline passed', async () => {
    const token = tokens.takeCaptchaToken('review');
    await flush();
    await vi.advanceTimersByTimeAsync(30_000);
    await token;
    warn.mockClear();
    state.reportCaptchaFault.mockClear();
    refuse('300030');

    expect(warn).not.toHaveBeenCalled();
    expect(state.reportCaptchaFault).not.toHaveBeenCalled();
  });

  it('gives no token for a failed challenge and reports its code', async () => {
    const token = tokens.takeCaptchaToken('nickname');
    await flush();
    refuse('110200');

    expect(await token).toBeNull();
    expect(warn).toHaveBeenCalledWith('[Turnstile] nickname: challenge failed (110200)');
    expect(state.reportCaptchaFault).toHaveBeenCalledWith('challenge failed (110200)');
  });

  it('reports a widget timeout, since a hidden window cannot show a challenge', async () => {
    const token = tokens.takeCaptchaToken('reply');
    await flush();
    refuse('timeout');

    expect(await token).toBeNull();
    expect(state.reportCaptchaFault).toHaveBeenCalledWith('challenge failed (timeout)');
  });

  it('gives no token and reports nothing when the page goes', async () => {
    const token = tokens.takeCaptchaToken('reply');
    await flush();
    lastSolve().settle(null);

    expect(await token).toBeNull();
    expect(warn).not.toHaveBeenCalled();
    expect(state.reportCaptchaFault).not.toHaveBeenCalled();
  });

  it.each([
    [
      'in an E2E run',
      () => {
        state.e2e = true;
      },
    ],
    [
      'without the page address',
      () => {
        state.url = null;
      },
    ],
    [
      'without a machine id',
      () => {
        state.machineId = null;
      },
    ],
  ])('never opens the window %s', async (_label, arrange) => {
    arrange();

    expect(await tokens.takeCaptchaToken('reply')).toBeNull();
    expect(state.solveCaptcha).not.toHaveBeenCalled();
  });

  it('hands the next write a ready token without a new solve', async () => {
    tokens.prefetchCaptchaToken('reply');
    await flush();
    solve('token-1');
    await flush();

    expect(await tokens.takeCaptchaToken('reply')).toBe('token-1');
    expect(state.solves).toHaveLength(1);
  });

  it('lets a write join a prefetch that is still solving', async () => {
    tokens.prefetchCaptchaToken('reply');
    const token = tokens.takeCaptchaToken('reply');
    await flush();
    solve('token-1');

    expect(await token).toBe('token-1');
    expect(state.solves).toHaveLength(1);
  });

  it('keeps one token per action', async () => {
    tokens.prefetchCaptchaToken('reply');
    tokens.prefetchCaptchaToken('reply');
    tokens.prefetchCaptchaToken('edit');
    await flush();

    expect(state.solves.map((request) => request.action)).toEqual(['reply', 'edit']);
  });

  it('hands a prefetched token to one write only', async () => {
    tokens.prefetchCaptchaToken('edit');
    await flush();
    solve('token-1');
    await flush();
    await tokens.takeCaptchaToken('edit');
    const second = tokens.takeCaptchaToken('edit');
    await flush();
    solve('token-2');

    expect(await second).toBe('token-2');
  });

  it('never hands out a token older than 240 s', async () => {
    tokens.prefetchCaptchaToken('reply');
    await flush();
    solve('old');
    await vi.advanceTimersByTimeAsync(240_000);
    const token = tokens.takeCaptchaToken('reply');
    await flush();
    solve('fresh');

    expect(await token).toBe('fresh');
  });

  it('replaces a stale token when asked again', async () => {
    tokens.prefetchCaptchaToken('reply');
    await flush();
    solve('old');
    await vi.advanceTimersByTimeAsync(240_000);
    tokens.prefetchCaptchaToken('reply');
    await flush();

    expect(state.solves).toHaveLength(2);
  });

  it('frees the slot of a failed prefetch, so the write solves its own', async () => {
    tokens.prefetchCaptchaToken('review');
    await flush();
    lastSolve().settle(null);
    await flush();
    const token = tokens.takeCaptchaToken('review');
    await flush();
    solve('token-2');

    expect(await token).toBe('token-2');
    expect(state.solves).toHaveLength(2);
  });

  it('opens no window in an E2E run', async () => {
    state.e2e = true;

    tokens.prefetchCaptchaToken('reply');
    await flush();

    expect(state.solveCaptcha).not.toHaveBeenCalled();
  });
});
