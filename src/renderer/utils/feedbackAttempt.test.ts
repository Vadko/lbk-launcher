import { describe, expect, it } from 'vitest';
import type { ReviewFailure } from '@/shared/game-reviews-api-types';
import {
  afterRefusal,
  attemptFor,
  type FeedbackAttempt,
  freshAttempt,
} from './feedbackAttempt';

const FILE_A = new File(['a'], 'a.png', { type: 'image/png' });
const FILE_B = new File(['b'], 'b.png', { type: 'image/png' });

const content = (extra: Partial<Parameters<typeof attemptFor>[1]> = {}) => ({
  type: 'feedback' as const,
  message: 'Text',
  files: [FILE_A],
  ...extra,
});

const attempt = (unconfirmed: FeedbackAttempt['unconfirmed']): FeedbackAttempt => ({
  id: 'post-1',
  uploads: new Map([[FILE_A, 'post-1/a.png']]),
  unconfirmed,
});

describe('freshAttempt', () => {
  it('starts with a new id and nothing uploaded', () => {
    const one = freshAttempt();

    expect(one).toEqual({
      id: expect.any(String),
      uploads: new Map(),
      unconfirmed: null,
    });
    expect(freshAttempt().id).not.toBe(one.id);
  });
});

describe('attemptFor', () => {
  it('keeps the attempt while every send got a clear answer', () => {
    const current = attempt(null);

    expect(attemptFor(current, content({ message: 'Other' }))).toBe(current);
  });

  it('keeps the attempt for the unconfirmed content itself', () => {
    const current = attempt(content());

    expect(attemptFor(current, content())).toBe(current);
  });

  it.each([
    ['another type', { type: 'error' as const }],
    ['another message', { message: 'Other' }],
    ['another screenshot', { files: [FILE_B] }],
    ['one more screenshot', { files: [FILE_A, FILE_B] }],
    ['no screenshots', { files: [] }],
  ])('starts over for %s after an unconfirmed send', (_label, change) => {
    const next = attemptFor(attempt(content()), content(change));

    expect(next.id).not.toBe('post-1');
    expect(next.uploads.size).toBe(0);
    expect(next.unconfirmed).toBeNull();
  });
});

describe('afterRefusal', () => {
  it.each([
    ['unreachable', 'retry', true],
    ['bad_response', 'retry', true],
    ['internal', 'retry', true],
    ['rate_limit', 'retry', false],
    ['captcha_unavailable', 'retry', false],
    ['not_found', 'rejected', false],
    ['id_conflict', 'rejected', false],
  ] as const)('%s (%s) leaves the content unconfirmed: %s', (code, kind, isUnknown) => {
    const failure: ReviewFailure = { code, kind };

    expect(afterRefusal(attempt(null), content(), failure).unconfirmed).toEqual(
      isUnknown ? content() : null
    );
  });
});
