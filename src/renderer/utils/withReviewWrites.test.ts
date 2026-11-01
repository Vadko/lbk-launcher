import { describe, expect, it } from 'vitest';
import type { GameReviewReply } from '@/shared/game-reviews-types';
import type { ReviewWrite } from '../queries/reviewWrite';
import type { ModerationVerdict } from './moderationVerdict';
import { reviewPages, reviewReply, reviewThread } from './reviewPages.fixture';
import { type ReviewWriteState, withReviewWrites } from './withReviewWrites';

const ANSWERED_AT = Date.UTC(2026, 9, 22, 11);
const BEFORE = ANSWERED_AT - 1;

const ownReply = (id: string): GameReviewReply => ({
  ...reviewReply(id, 3),
  author: { role: 'player', name: 'Owl', avatarSeed: 'seed', isMine: true },
  moderation: 'pending',
});
const replyWrite = (id: string, reviewId = 't'): ReviewWrite => ({
  kind: 'reply',
  entryId: id,
  reviewId,
  isPublic: true,
  reply: ownReply(id),
});
const editWrite = (id: string, text: string, reviewId = 't'): ReviewWrite => ({
  kind: 'edit',
  entryId: id,
  reviewId,
  isPublic: true,
  text,
});
const checking = (write: ReviewWrite): ReviewWriteState => ({
  write,
  failure: null,
  answer: null,
});
const failed = (write: ReviewWrite): ReviewWriteState => ({
  write,
  failure: { code: 'unreachable', kind: 'retry' },
  answer: null,
});
const answered = (
  write: ReviewWrite,
  verdict: ModerationVerdict | null
): ReviewWriteState => ({
  write,
  failure: null,
  answer: { verdict, refusal: null, answeredAt: ANSWERED_AT },
});

const pendingEntry = { ...reviewReply('r'), moderation: 'pending' as const };
const data = reviewPages([
  reviewThread('t', [reviewReply('r'), reviewReply('p')]),
  reviewThread('u'),
]);
const dataWithPending = reviewPages([
  reviewThread('t', [pendingEntry]),
  reviewThread('u'),
]);

const view = (states: ReviewWriteState[], pages = data, updatedAt = BEFORE) =>
  withReviewWrites(pages, states, updatedAt);
const thread = (states: ReviewWriteState[], pages = data, updatedAt = BEFORE) =>
  view(states, pages, updatedAt).pages[0].items.find((item) => item.id === 't');
const entry = (id: string, states: ReviewWriteState[], pages = data) =>
  [thread(states, pages), ...(thread(states, pages)?.replies ?? [])].find(
    (item) => item?.id === id
  );

describe('withReviewWrites', () => {
  it('hands back the pages as they are without a write', () => {
    expect(view([])).toBe(data);
  });

  it('keeps the threads no write touches', () => {
    const shown = view([checking(replyWrite('n'))]);

    expect(shown.pages[0].items[1]).toBe(data.pages[0].items[1]);
  });

  it('adds a reply still checking to its thread', () => {
    expect(entry('n', [checking(replyWrite('n'))])).toMatchObject({
      text: 'n',
      write: 'reply',
      isChecking: true,
    });
  });

  it('marks a reply a refetch already brought instead of adding it again', () => {
    const replies = thread([checking(replyWrite('r'))], dataWithPending)?.replies ?? [];

    expect(replies).toEqual([expect.objectContaining({ id: 'r', isChecking: true })]);
  });

  it('shows a failed reply with its failure', () => {
    expect(entry('n', [failed(replyWrite('n'))])).toMatchObject({
      write: 'reply',
      failure: { code: 'unreachable' },
    });
    expect(entry('n', [failed(replyWrite('n'))])).not.toHaveProperty('isChecking');
  });

  it('shows an answered reply with its verdict until pages fetched after the answer', () => {
    const states = [answered(replyWrite('n'), 'published')];

    expect(entry('n', states)).toMatchObject({ moderation: 'published' });
    expect(entry('n', states)).not.toHaveProperty('isChecking');
    expect(view(states, data, ANSWERED_AT + 1)).toBe(data);
  });

  it.each([
    ['removed', 'removed' as const],
    ['refused', null],
  ])('leaves out a reply the server %s', (_label, verdict) => {
    expect(entry('n', [answered(replyWrite('n'), verdict)])).toBeUndefined();
  });

  it('ignores a write whose thread the pages do not hold', () => {
    expect(view([checking(replyWrite('n', 'elsewhere'))]).pages[0].items).toEqual(
      data.pages[0].items
    );
  });

  it('shows an edit of a published entry beside its text while it checks', () => {
    expect(entry('r', [checking(editWrite('r', 'new'))])).toMatchObject({
      text: 'r',
      pendingText: 'new',
      write: 'edit',
      isChecking: true,
    });
  });

  it('replaces the text of an entry still awaiting moderation', () => {
    expect(entry('r', [checking(editWrite('r', 'new'))], dataWithPending)).toMatchObject({
      text: 'new',
      pendingText: null,
    });
  });

  it('publishes an answered edit and dates it', () => {
    expect(entry('r', [answered(editWrite('r', 'new'), 'published')])).toMatchObject({
      text: 'new',
      pendingText: null,
      moderation: 'published',
      editedAt: new Date(ANSWERED_AT).toISOString(),
    });
  });

  it('keeps a published entry beside its edit while moderation holds it', () => {
    expect(entry('r', [answered(editWrite('r', 'new'), 'pending')])).toMatchObject({
      text: 'r',
      pendingText: 'new',
      moderation: 'published',
    });
  });

  it('drops a rejected edit and marks the entry rolled back', () => {
    const pages = reviewPages([
      reviewThread('t', [{ ...reviewReply('r'), pendingText: 'held' }]),
    ]);

    expect(
      entry('r', [answered(editWrite('r', 'new'), 'rolledBack')], pages)
    ).toMatchObject({
      text: 'r',
      pendingText: null,
      isRolledBack: true,
    });
  });

  it('keeps an earlier edit under moderation when the server stored nothing of the next', () => {
    const pages = reviewPages([
      reviewThread('t', [{ ...reviewReply('r'), pendingText: 'held' }]),
    ]);

    expect(entry('r', [answered(editWrite('r', 'new'), null)], pages)).toMatchObject({
      pendingText: 'held',
      isRolledBack: true,
    });
  });

  it('leaves out a reply taken down on its edit', () => {
    expect(entry('r', [answered(editWrite('r', 'new'), 'removed')])).toBeUndefined();
    expect(entry('p', [answered(editWrite('r', 'new'), 'removed')])).toBeDefined();
  });

  it('leaves out a thread whose root was taken down on its edit', () => {
    const shown = view([answered(editWrite('t', 'new'), 'removed')]);

    expect(shown.pages[0].items.map((item) => item.id)).toEqual(['u']);
  });
});
