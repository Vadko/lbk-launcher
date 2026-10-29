import { QueryClient } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReviewEditInput, ReviewReplyInput } from '@/shared/game-reviews-api-types';
import type { ReviewAuthorIdentity } from '@/shared/game-reviews-types';
import { useReviewOverlayStore } from '../store/useReviewOverlayStore';
import type { ReviewPages } from '../utils/reviewCache';
import {
  banned,
  deferAnswer,
  flush,
  heldWrites,
  isCached,
  liveSignal,
  needsAuthor,
  OWL,
  published,
  REVIEWS_KEY,
  rateLimit,
  seedReviews,
  shownEntry,
  unreachable,
  type WriteAnswer,
} from './reviewActions.fixture';

const sendReviewReply = vi.fn<(input: ReviewReplyInput) => Promise<WriteAnswer>>();
const sendReviewEdit = vi.fn<(input: ReviewEditInput) => Promise<WriteAnswer>>();
const ensureAuthor =
  vi.fn<(signal?: AbortSignal) => Promise<ReviewAuthorIdentity | null>>();
const forgetAuthor = vi.fn();
vi.mock('./reviewsClient', () => ({ sendReviewReply, sendReviewEdit }));
vi.mock('../store/useReviewAuthorStore', () => ({
  useReviewAuthorStore: { getState: () => ({ ensureAuthor, forgetAuthor }) },
}));

const { createReviewActions } = await import('./createReviewActions');

let queryClient: QueryClient;

function seed(isPublic: boolean, viewer: ReviewAuthorIdentity | null = null) {
  seedReviews(queryClient, isPublic, viewer);
  return createReviewActions(queryClient, 'g1');
}

const sentIds = () => sendReviewReply.mock.calls.map(([input]) => input.id);
const cached = () => queryClient.getQueryData<ReviewPages>(REVIEWS_KEY);
const shown = (id: string) => shownEntry(queryClient, id);
const inCache = (id: string) => isCached(queryClient, id);

beforeEach(() => {
  queryClient = new QueryClient();
  useReviewOverlayStore.setState({ games: new Map() });
  sendReviewReply.mockReset();
  sendReviewReply.mockImplementation(({ id }) => Promise.resolve(published(id)));
  sendReviewEdit.mockReset();
  sendReviewEdit.mockImplementation(({ id }) => Promise.resolve(published(id)));
  ensureAuthor.mockReset();
  forgetAuthor.mockReset();
});

describe('createReviewActions overlay', () => {
  it('sends nothing for a thread the pages do not hold', async () => {
    const onShown = vi.fn();

    await expect(
      seed(true, OWL).sendReply('missing', 'hi', null, onShown, liveSignal())
    ).resolves.toBe(false);

    expect(sendReviewReply).not.toHaveBeenCalled();
    expect(onShown).not.toHaveBeenCalled();
    expect(heldWrites().size).toBe(0);
  });

  it('keeps an unanswered reply out of the cache and shows it from the overlay', async () => {
    const answer = deferAnswer(sendReviewReply);
    const onShown = vi.fn();

    await seed(false).sendReply('t', 'hi', null, onShown, liveSignal());
    const id = sentIds()[0];

    expect(onShown).toHaveBeenCalled();
    expect(inCache(id)).toBe(false);
    expect(shown(id)).toMatchObject({ text: 'hi', isChecking: true, write: 'reply' });
    answer(published(id));
  });

  it('hands a taken reply to the cache without a moment it is missing', async () => {
    const answer = deferAnswer(sendReviewReply);
    await seed(false).sendReply('t', 'hi', null, vi.fn(), liveSignal());
    const id = sentIds()[0];
    const visible: boolean[] = [];
    const stop = useReviewOverlayStore.subscribe(() =>
      visible.push(shown(id) !== undefined)
    );

    answer(published(id));
    await vi.waitFor(() => expect(heldWrites().size).toBe(0));
    stop();

    expect(visible).toEqual([true]);
    expect(inCache(id)).toBe(true);
    expect(shown(id)).toMatchObject({ moderation: 'published' });
    expect(shown(id)?.isChecking).toBeUndefined();
  });

  it.each([
    ['a retry', rateLimit, 'rate_limit'],
    ['a needs-author', needsAuthor, 'author_required'],
  ])('turns the reply failed on %s answer', async (_label, answer, code) => {
    sendReviewReply.mockResolvedValue(answer);
    ensureAuthor.mockResolvedValue(null);

    await seed(false).sendReply('t', 'hi', null, vi.fn(), liveSignal());
    await flush();

    expect(shown(sentIds()[0])).toMatchObject({
      isChecking: false,
      failure: { code },
    });
    expect(inCache(sentIds()[0])).toBe(false);
  });

  it('drops a rejected reply', async () => {
    sendReviewReply.mockResolvedValue(banned);

    await seed(false).sendReply('t', 'hi', null, vi.fn(), liveSignal());
    await flush();

    expect(shown(sentIds()[0])).toBeUndefined();
  });

  it('keeps a failed reply through a dropped and refetched query and resends it', async () => {
    sendReviewReply.mockResolvedValueOnce(rateLimit);

    await seed(false).sendReply('t', 'hi', null, vi.fn(), liveSignal());
    await flush();
    const id = sentIds()[0];
    queryClient.removeQueries({ queryKey: REVIEWS_KEY });
    const actions = seed(false);

    expect(inCache(id)).toBe(false);
    expect(shown(id)?.failure?.code).toBe('rate_limit');
    await actions.resend(id);

    expect(sentIds()).toEqual([id, id]);
    expect(inCache(id)).toBe(true);
    expect(heldWrites().size).toBe(0);
  });

  it('dates a new reply after one the overlay still holds', async () => {
    const now = vi
      .spyOn(Date, 'now')
      .mockReturnValue(Date.parse('2026-10-26T12:00:00.000Z'));
    sendReviewReply.mockResolvedValueOnce(rateLimit);
    const actions = seed(false);

    await actions.sendReply('t', 'first', null, vi.fn(), liveSignal());
    await flush();
    await actions.sendReply('t', 'second', null, vi.fn(), liveSignal());
    await flush();
    now.mockRestore();
    const [first, second] = sentIds().map((id) => Date.parse(shown(id)?.createdAt ?? ''));

    expect(second).toBeGreaterThan(first);
  });

  it.each([
    ['sends again the refetch the hand-over cancelled', true],
    ['leaves the pages fresh when nothing was fetching', false],
  ])('%s', async (_label, fetching) => {
    const answer = deferAnswer(sendReviewReply);
    const actions = seed(false);
    await actions.sendReply('t', 'hi', null, vi.fn(), liveSignal());
    if (fetching) {
      queryClient
        .fetchInfiniteQuery({
          queryKey: REVIEWS_KEY,
          queryFn: () => new Promise<never>(() => undefined),
          initialPageParam: null,
        })
        .catch(() => undefined);
    }

    answer(published(sentIds()[0]));
    await vi.waitFor(() => expect(heldWrites().size).toBe(0));

    expect(inCache(sentIds()[0])).toBe(true);
    expect(queryClient.getQueryState(REVIEWS_KEY)?.isInvalidated).toBe(fetching);
  });

  it.each([
    ['refetches after a discard whose outcome is unknown', unreachable, 1],
    ['leaves the list alone after a clear refusal', rateLimit, 0],
  ])('%s', async (_label, answer, refetches) => {
    sendReviewReply.mockResolvedValue(answer);
    const actions = seed(false);
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');

    await actions.sendReply('t', 'hi', null, vi.fn(), liveSignal());
    await flush();
    actions.discard(sentIds()[0]);

    expect(shown(sentIds()[0])).toBeUndefined();
    expect(invalidate).toHaveBeenCalledTimes(refetches);
  });

  it('ignores an answer that lands after the discard', async () => {
    const answer = deferAnswer(sendReviewReply);
    const actions = seed(false);
    const before = cached();

    await actions.sendReply('t', 'hi', null, vi.fn(), liveSignal());
    const id = sentIds()[0];
    actions.discard(id);
    answer(published(id));
    await flush();

    expect(cached()).toBe(before);
    expect(shown(id)).toBeUndefined();
  });

  it('shows an edit from the overlay and hands it to the cache once taken', async () => {
    const answer = deferAnswer(sendReviewEdit);
    const actions = seed(false);

    await actions.edit('mine', 'changed', vi.fn());
    expect(shown('mine')).toMatchObject({ pendingText: 'changed', isChecking: true });
    expect(shown('mine')?.text).toBe('mine');

    answer(published('mine'));
    await vi.waitFor(() => expect(heldWrites().size).toBe(0));

    expect(shown('mine')).toMatchObject({ text: 'changed', pendingText: null });
  });

  it('shows the cached text again when an edit is rejected', async () => {
    sendReviewEdit.mockResolvedValue(banned);
    const actions = seed(false);

    await actions.edit('mine', 'changed', vi.fn());
    await flush();

    expect(shown('mine')).toMatchObject({ text: 'mine', pendingText: null });
    expect(heldWrites().size).toBe(0);
  });

  it.each([
    ['resends a failed edit inside its window', 'mine', 2],
    ['offers no resend once the edit window closed', 'old', 1],
  ])('%s', async (_label, entryId, sends) => {
    sendReviewEdit.mockResolvedValueOnce(rateLimit);
    const actions = seed(false);

    await actions.edit(entryId, 'changed', vi.fn());
    await flush();
    expect(shown(entryId)?.failure?.code).toBe('rate_limit');
    await actions.resend(entryId);

    expect(sendReviewEdit).toHaveBeenCalledTimes(sends);
  });
});
