import { beforeEach, describe, expect, it } from 'vitest';
import type { ReviewFailure } from '@/shared/game-reviews-api-types';
import type { ReviewWriteDraft } from '../utils/reviewOverlay';
import { useReviewOverlayStore } from './useReviewOverlayStore';

const EDIT: ReviewWriteDraft = { kind: 'edit', text: 'changed' };
const FAILURE: ReviewFailure = { code: 'rate_limit', kind: 'retry' };
const resend = () => Promise.resolve();

const store = () => useReviewOverlayStore.getState();

beforeEach(() => {
  useReviewOverlayStore.setState({
    games: new Map(),
    rolledBack: new Map(),
    posting: new Set(),
    shown: new Map(),
  });
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

  it('never brings back a dropped write on a late failure', () => {
    store().start('g1', 'e', EDIT);
    store().drop('g1', 'e');

    store().fail('g1', 'e', FAILURE, resend);

    expect(store().writeOf('g1', 'e')).toBeUndefined();
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

  it('rolls an edit back by dropping it and marking its entry in one update', () => {
    store().start('g1', 'e', EDIT);
    const updates: [boolean, boolean][] = [];
    const stop = useReviewOverlayStore.subscribe((state) =>
      updates.push([state.games.has('g1'), state.rolledBack.get('g1')?.has('e') === true])
    );

    store().rollBack('g1', 'e', true);
    stop();

    expect(updates).toEqual([[false, true]]);
  });

  it('clears the mark once a new write on the entry starts', () => {
    store().rollBack('g1', 'e', false);
    store().rollBack('g1', 'other', false);

    store().start('g1', 'e', EDIT);

    expect([...(store().rolledBack.get('g1') ?? [])]).toEqual(['other']);
  });

  it('keeps the marks as they are when a write starts on an unmarked entry', () => {
    store().rollBack('g1', 'e', false);
    const before = store().rolledBack;

    store().start('g1', 'x', EDIT);

    expect(store().rolledBack).toBe(before);
  });

  it('marks a rollback without dropping the write that failed to send', () => {
    const attempt = store().start('g1', 'e', EDIT);
    store().fail('g1', 'e', FAILURE, resend);

    store().rollBack('g1', 'e', false);

    expect(store().writeOf('g1', 'e')).toMatchObject({ state: 'failed', attempt });
    expect(store().rolledBack.get('g1')?.has('e')).toBe(true);
  });

  it('hands a shown verdict out once', () => {
    store().markShown('e', 'removed');

    expect(store().takeShown('e')).toBe('removed');
    expect(store().takeShown('e')).toBeUndefined();
  });

  it('ends a post and marks its verdict in one update', () => {
    store().startPost('p');
    const updates: [boolean, string | undefined][] = [];
    const stop = useReviewOverlayStore.subscribe((state) =>
      updates.push([state.posting.has('p'), state.shown.get('p')])
    );

    store().endPost('p', 'published');
    stop();

    expect(updates).toEqual([[false, 'published']]);
  });

  it('marks nothing for a post without an answer', () => {
    store().startPost('p');

    store().endPost('p', null);

    expect(store().posting.size).toBe(0);
    expect(store().shown.size).toBe(0);
  });
});
