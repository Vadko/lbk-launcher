import { QueryClient } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useReviewOverlayStore } from '../store/useReviewOverlayStore';
import { findEntry, type ReviewPages } from '../utils/reviewCache';
import { reviewPages, reviewReply, reviewThread } from '../utils/reviewPages.fixture';
import { reviewRefusalMessage } from '../utils/reviewRefusalMessage';
import { REVIEWS_KEY } from './reviewActions.fixture';

const showToast = vi.fn();
vi.mock('../store/useSubscriptionsStore', () => ({
  useSubscriptionsStore: { getState: () => ({ showToast }) },
}));

const { refuseReviewWrite } = await import('./refuseReviewWrite');

let queryClient: QueryClient;
const cached = () => queryClient.getQueryData<ReviewPages>(REVIEWS_KEY);
const REASONS = {
  gone: 'removed',
  refused: 'edit_limit_reached',
  rolledBack: 'edit_rejected',
} as const;
const refusal = (entryId: string, effect: keyof typeof REASONS) => ({
  gameId: 'g1',
  gameName: 'Game',
  entryId,
  effect,
  reason: REASONS[effect],
});

beforeEach(() => {
  queryClient = new QueryClient();
  useReviewOverlayStore.setState({
    games: new Map(),
    rolledBack: new Map(),
    shown: new Map(),
  });
  showToast.mockReset();
  queryClient.setQueryData<ReviewPages>(
    REVIEWS_KEY,
    reviewPages([
      reviewThread('t', [
        { ...reviewReply('held'), pendingText: 'changed' },
        { ...reviewReply('answer'), parentId: 'held' },
      ]),
    ])
  );
});

describe('refuseReviewWrite', () => {
  it('rolls back an edit the cache already holds and marks its entry', () => {
    refuseReviewWrite(queryClient, refusal('held', 'rolledBack'));

    expect(findEntry(cached(), 'held')?.entry).toMatchObject({
      text: 'held',
      pendingText: null,
    });
    expect(useReviewOverlayStore.getState().rolledBack.get('g1')?.has('held')).toBe(true);
    expect(showToast).toHaveBeenCalledWith({
      type: 'review-rejected',
      gameId: 'g1',
      gameName: 'Game',
      entryId: 'held',
      message: reviewRefusalMessage('edit_rejected'),
    });
  });

  it('keeps an earlier edit still under moderation when the server stored nothing', () => {
    const before = cached();
    const attempt = useReviewOverlayStore
      .getState()
      .start('g1', 'held', { kind: 'edit', text: 'again' });

    refuseReviewWrite(queryClient, { ...refusal('held', 'refused'), attempt });

    expect(cached()).toBe(before);
    expect(findEntry(cached(), 'held')?.entry.pendingText).toBe('changed');
    expect(useReviewOverlayStore.getState().games.get('g1')).toBeUndefined();
    expect(useReviewOverlayStore.getState().rolledBack.get('g1')?.has('held')).toBe(true);
  });

  it('leaves a stub where a removed reply still holds an answer, and drops its write', () => {
    useReviewOverlayStore.getState().start('g1', 'held', { kind: 'edit', text: 'again' });

    refuseReviewWrite(queryClient, refusal('held', 'gone'));

    expect(useReviewOverlayStore.getState().writeOf('g1', 'held')).toBeUndefined();

    expect(cached()?.pages[0]?.items[0]?.replies).toEqual([
      expect.objectContaining({ id: 'held', removed: true }),
      expect.objectContaining({ id: 'answer' }),
    ]);
  });

  it('leaves the cache alone for a write it never held', () => {
    const before = cached();
    const updatedAt = queryClient.getQueryState(REVIEWS_KEY)?.dataUpdatedAt;

    refuseReviewWrite(queryClient, refusal('unsent', 'gone'));

    expect(cached()).toBe(before);
    expect(queryClient.getQueryState(REVIEWS_KEY)?.dataUpdatedAt).toBe(updatedAt);
  });

  it('announces through the caller when it brings its own notice', () => {
    const announce = vi.fn();

    refuseReviewWrite(queryClient, refusal('answer', 'gone'), announce);

    expect(announce).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'review-rejected', gameId: 'g1' })
    );
    expect(showToast).not.toHaveBeenCalled();
  });
});
