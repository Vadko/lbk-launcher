import { beforeEach, describe, expect, it } from 'vitest';
import type { ReviewFailure } from '@/shared/game-reviews-api-types';
import type { ReviewWriteDraft } from '../utils/reviewOverlay';
import { useReviewOverlayStore } from './useReviewOverlayStore';

const EDIT: ReviewWriteDraft = { kind: 'edit', text: 'changed' };
const FAILURE: ReviewFailure = { code: 'rate_limit', kind: 'retry' };
const resend = () => Promise.resolve();

const store = () => useReviewOverlayStore.getState();

beforeEach(() => {
  useReviewOverlayStore.setState({ games: new Map() });
});

describe('useReviewOverlayStore', () => {
  it('starts a write as checking under a fresh attempt every time', () => {
    const first = store().start('g1', 'e', EDIT);
    const second = store().start('g1', 'e', EDIT);

    expect(second).toBeGreaterThan(first);
    expect(store().writeOf('g1', 'e')).toEqual({
      ...EDIT,
      state: 'checking',
      attempt: second,
    });
  });

  it('fails only the attempt the answer belongs to', () => {
    const stale = store().start('g1', 'e', EDIT);
    const current = store().start('g1', 'e', EDIT);

    store().fail('g1', 'e', stale, FAILURE, resend);
    expect(store().writeOf('g1', 'e')?.state).toBe('checking');

    store().fail('g1', 'e', current, FAILURE, resend);
    expect(store().writeOf('g1', 'e')).toMatchObject({
      state: 'failed',
      failure: FAILURE,
      attempt: current,
    });
  });

  it('never brings back a dropped write on a late failure', () => {
    const attempt = store().start('g1', 'e', EDIT);
    store().drop('g1', 'e');

    store().fail('g1', 'e', attempt, FAILURE, resend);

    expect(store().writeOf('g1', 'e')).toBeUndefined();
  });

  it('drops a write only for its own attempt when one is given', () => {
    const stale = store().start('g1', 'e', EDIT);
    store().start('g1', 'e', EDIT);

    store().drop('g1', 'e', stale);

    expect(store().writeOf('g1', 'e')).toBeDefined();
  });

  it('keeps the other games and removes a game left without writes', () => {
    store().start('g1', 'e', EDIT);
    store().start('g2', 'x', EDIT);
    const other = store().games.get('g2');

    store().drop('g1', 'e');

    expect([...store().games.keys()]).toEqual(['g2']);
    expect(store().games.get('g2')).toBe(other);
  });

  it('gives the changed game a new slice and leaves the old one as it was', () => {
    store().start('g1', 'a', EDIT);
    const before = store().games.get('g1');

    store().start('g1', 'b', EDIT);

    expect(store().games.get('g1')).not.toBe(before);
    expect([...(before?.keys() ?? [])]).toEqual(['a']);
  });
});
