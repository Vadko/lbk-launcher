import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  NicknameSpin,
  NicknameSpinInput,
  ReviewAuthorState,
  ReviewResult,
} from '@/shared/game-reviews-api-types';
import { gameReviewsQueryKey } from '../queries/gameReviewsQueryKey';
import { queryClient } from '../queries/queryClient';
import { reviewPages, reviewThread } from '../utils/reviewPages.fixture';

const fetchReviewAuthor = vi.fn<() => Promise<ReviewResult<ReviewAuthorState>>>();
const spinNickname =
  vi.fn<(input: NicknameSpinInput) => Promise<ReviewResult<NicknameSpin>>>();
vi.mock('../queries/reviewsClient', () => ({ fetchReviewAuthor, spinNickname }));

const { useReviewAuthorStore } = await import('./useReviewAuthorStore');

const OWL = { name: 'Quiet Owl', avatarSeed: '0a1b2c3d4e5f' };
const SPIN: NicknameSpin = {
  spinId: '00000000-0000-4000-8000-000000000001',
  avatarSeed: 'seed1',
  adjective: 'Quiet',
  noun: 'Owl',
  name: 'Quiet Owl',
  decoys: { avatarSeeds: [], adjectives: [], nouns: [] },
  spinsLeft: 41,
};
const FRESH: NicknameSpinInput = {
  spinId: null,
  hold: { avatar: false, adjective: false, noun: false },
};
const store = () => useReviewAuthorStore.getState();
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
const answer = (author: ReviewAuthorState['author']) =>
  Promise.resolve<ReviewResult<ReviewAuthorState>>({
    ok: true,
    data: { author, spinsLeft: 60 },
  });

beforeEach(() => {
  fetchReviewAuthor.mockReset();
  spinNickname.mockReset();
  useReviewAuthorStore.setState({
    author: null,
    lastSpin: null,
    lastSpinAt: null,
    spinsLeft: null,
    isPickerOpen: false,
  });
});

afterEach(() => {
  store().closePicker();
  queryClient.clear();
  vi.useRealTimers();
});

describe('useReviewAuthorStore', () => {
  it('answers at once with a known nickname', async () => {
    useReviewAuthorStore.setState({ author: OWL });

    await expect(store().ensureAuthor()).resolves.toEqual(OWL);
    expect(fetchReviewAuthor).not.toHaveBeenCalled();
  });

  it('takes an existing nickname from the server without the picker', async () => {
    fetchReviewAuthor.mockReturnValue(answer(OWL));

    await expect(store().ensureAuthor()).resolves.toEqual(OWL);
    await expect(store().ensureAuthor()).resolves.toEqual(OWL);
    expect(fetchReviewAuthor).toHaveBeenCalledTimes(1);
    expect(store().isPickerOpen).toBe(false);
  });

  it('opens one picker for every caller and gives them the claimed nickname', async () => {
    fetchReviewAuthor.mockReturnValue(answer(null));
    queryClient.setQueryData(gameReviewsQueryKey('g1'), reviewPages([reviewThread('a')]));

    const first = store().ensureAuthor();
    const second = store().ensureAuthor();
    await flush();
    expect(store().isPickerOpen).toBe(true);
    expect(fetchReviewAuthor).toHaveBeenCalledTimes(1);

    store().pickAuthor(OWL);

    await expect(Promise.all([first, second])).resolves.toEqual([OWL, OWL]);
    expect(store()).toMatchObject({ author: OWL, isPickerOpen: true });
    const pages = queryClient.getQueryData<{ pages: { viewer: unknown }[] }>(
      gameReviewsQueryKey('g1')
    );
    expect(pages?.pages[0]?.viewer).toEqual(OWL);
  });

  it('resolves null when the picker is closed and opens a new one next time', async () => {
    fetchReviewAuthor.mockReturnValue(answer(null));

    const cancelled = store().ensureAuthor();
    await flush();
    store().closePicker();
    await expect(cancelled).resolves.toBeNull();
    expect(store()).toMatchObject({ author: null, isPickerOpen: false });

    const next = store().ensureAuthor();
    await flush();
    expect(store().isPickerOpen).toBe(true);
    expect(next).not.toBe(cancelled);
  });

  it('joins an open picker without a second lookup', async () => {
    fetchReviewAuthor.mockReturnValue(answer(null));

    const first = store().ensureAuthor();
    await flush();
    const late = store().ensureAuthor();
    store().pickAuthor(OWL);

    await expect(Promise.all([first, late])).resolves.toEqual([OWL, OWL]);
    expect(fetchReviewAuthor).toHaveBeenCalledTimes(1);
  });

  it('opens no picker for a caller that aborted during the lookup', async () => {
    let lookedUp: (result: ReviewResult<ReviewAuthorState>) => void = () => undefined;
    fetchReviewAuthor.mockReturnValue(
      new Promise((resolve) => {
        lookedUp = resolve;
      })
    );
    const composer = new AbortController();

    const cancelled = store().ensureAuthor(composer.signal);
    composer.abort();
    lookedUp({ ok: true, data: { author: null, spinsLeft: 60 } });

    await expect(cancelled).resolves.toBeNull();
    expect(store().isPickerOpen).toBe(false);
  });

  it('still opens the picker for a caller that shares the lookup without aborting', async () => {
    let lookedUp: (result: ReviewResult<ReviewAuthorState>) => void = () => undefined;
    fetchReviewAuthor.mockReturnValue(
      new Promise((resolve) => {
        lookedUp = resolve;
      })
    );
    const composer = new AbortController();

    const cancelled = store().ensureAuthor(composer.signal);
    const kept = store().ensureAuthor();
    composer.abort();
    lookedUp({ ok: true, data: { author: null, spinsLeft: 60 } });

    await expect(cancelled).resolves.toBeNull();
    await flush();
    expect(store().isPickerOpen).toBe(true);
    expect(fetchReviewAuthor).toHaveBeenCalledTimes(1);
    store().pickAuthor(OWL);
    await expect(kept).resolves.toEqual(OWL);
  });

  it('opens the picker when the lookup fails', async () => {
    fetchReviewAuthor.mockResolvedValue({
      ok: false,
      failure: { code: 'unreachable', kind: 'retry' },
    });

    void store().ensureAuthor();
    await flush();

    expect(store().isPickerOpen).toBe(true);
  });

  it('asks the server again after the nickname is forgotten', async () => {
    useReviewAuthorStore.setState({ author: OWL });
    fetchReviewAuthor.mockReturnValue(answer(null));

    store().forgetAuthor();
    void store().ensureAuthor();
    await flush();

    expect(fetchReviewAuthor).toHaveBeenCalledTimes(1);
    expect(store().isPickerOpen).toBe(true);
  });

  it('closes the picker after a pick without changing the answer', async () => {
    fetchReviewAuthor.mockReturnValue(answer(null));

    const picked = store().ensureAuthor();
    await flush();
    store().pickAuthor(OWL);
    store().closePicker();

    await expect(picked).resolves.toEqual(OWL);
    expect(store().isPickerOpen).toBe(false);
  });

  it('keeps the latest spin for the next picker, even after the picker closed', async () => {
    spinNickname.mockResolvedValue({ ok: true, data: SPIN });

    const result = store().spin(FRESH);
    store().closePicker();
    await result;

    expect(store().lastSpin).toBe(SPIN);
    expect(store().openingSpin()).toBe(SPIN);
  });

  it('joins a spin on its way instead of dealing again', async () => {
    const replies: ((result: ReviewResult<NicknameSpin>) => void)[] = [];
    spinNickname.mockImplementation(
      () => new Promise((resolve) => replies.push(resolve))
    );
    useReviewAuthorStore.setState({ lastSpin: { ...SPIN, spinId: 'older' } });

    const first = store().spin(FRESH);
    expect(store().openingSpin()).toBeNull();
    const second = store().spin(FRESH);
    replies[0]?.({ ok: true, data: SPIN });

    await expect(second).resolves.toEqual({ ok: true, data: SPIN });
    await expect(first).resolves.toEqual({ ok: true, data: SPIN });
    expect(spinNickname).toHaveBeenCalledTimes(1);
    expect(store().openingSpin()).toBe(SPIN);
  });

  it('keeps the shown spin when a spin fails', async () => {
    spinNickname.mockResolvedValue({
      ok: false,
      failure: { code: 'rate_limit', kind: 'rejected' },
    });
    useReviewAuthorStore.setState({ lastSpin: SPIN, lastSpinAt: Date.now() });

    await store().spin(FRESH);

    expect(store().openingSpin()).toBe(SPIN);
    expect(store().spinsLeft).toBe(0);
  });

  it('tracks the spins left from the lookup and from each spin', async () => {
    fetchReviewAuthor.mockResolvedValue({
      ok: true,
      data: { author: null, spinsLeft: 12 },
    });
    void store().ensureAuthor();
    await vi.waitFor(() => expect(store().isPickerOpen).toBe(true));
    expect(store().spinsLeft).toBe(12);

    spinNickname.mockResolvedValue({ ok: true, data: { ...SPIN, spinsLeft: 11 } });
    await store().spin(FRESH);

    expect(store().spinsLeft).toBe(11);
  });

  it.each([
    [22, true],
    [23.5, false],
    [30, false],
  ])('offers a spin %s h old to the next picker: %s', async (hoursLater, offered) => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-01T12:00:00Z'));
    spinNickname.mockResolvedValue({ ok: true, data: SPIN });
    await store().spin(FRESH);

    vi.setSystemTime(Date.now() + hoursLater * 60 * 60 * 1000);

    expect(store().openingSpin()).toBe(offered ? SPIN : null);
    expect(store().lastSpin).toBe(SPIN);
  });

  it('forgets the spin and its age once a nickname is picked', async () => {
    spinNickname.mockResolvedValue({ ok: true, data: SPIN });
    await store().spin(FRESH);

    store().pickAuthor(OWL);

    expect(store()).toMatchObject({ lastSpin: null, lastSpinAt: null });
    expect(store().openingSpin()).toBeNull();
  });
});
