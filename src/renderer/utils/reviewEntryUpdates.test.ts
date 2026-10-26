import { describe, expect, it } from 'vitest';
import type { GameReviewEntry } from '@/shared/game-reviews-types';
import {
  afterEdit,
  afterReply,
  markChecking,
  markFailed,
  restored,
  withEdit,
} from './reviewEntryUpdates';

const NOW = '2026-10-26T12:00:00.000Z';

const entry = (extra: Partial<GameReviewEntry> = {}): GameReviewEntry => ({
  id: 'e',
  text: 'old',
  createdAt: '2026-10-26T11:55:00.000Z',
  editedAt: null,
  author: { role: 'player', name: 'Quiet Owl', avatarSeed: 'seed', isMine: true },
  moderation: 'published',
  pendingText: null,
  ...extra,
});

describe('afterReply', () => {
  it.each([
    ['published', { moderation: 'published', isChecking: false }],
    ['pending', { moderation: 'pending', isChecking: false }],
  ] as const)('settles a %s reply', (outcome, expected) => {
    expect(
      afterReply(outcome)(entry({ moderation: 'pending', isChecking: true }))
    ).toEqual(entry(expected));
  });

  it('drops a removed reply', () => {
    expect(afterReply('removed')(entry())).toBeNull();
  });
});

describe('withEdit', () => {
  it.each([
    [
      'keeps a published text and holds the edit aside',
      'published',
      { pendingText: 'new' },
    ],
    ['replaces an unpublished text', 'pending', { text: 'new' }],
  ] as const)('%s', (_label, moderation, change) => {
    expect(withEdit('new')(entry({ moderation }))).toEqual(
      entry({ moderation, isChecking: true, ...change })
    );
  });
});

describe('afterEdit', () => {
  it.each([
    [
      'a published entry whose edit went through',
      entry({ pendingText: 'new', isChecking: true }),
      'published',
      entry({ text: 'new', editedAt: NOW, isChecking: false }),
    ],
    [
      'a published entry whose edit waits for a moderator',
      entry({ pendingText: 'new', isChecking: true }),
      'pending',
      entry({ pendingText: 'new', isChecking: false }),
    ],
    [
      'an unpublished entry that got published',
      entry({ moderation: 'pending', text: 'new', isChecking: true }),
      'published',
      entry({ text: 'new', isChecking: false }),
    ],
    [
      'an unpublished entry still waiting',
      entry({ moderation: 'pending', text: 'new', isChecking: true }),
      'pending',
      entry({ moderation: 'pending', text: 'new', isChecking: false }),
    ],
  ] as const)('settles %s', (_label, before, outcome, expected) => {
    expect(afterEdit(outcome, 'new', NOW)(before)).toEqual(expected);
  });

  it('drops an entry moderation removed', () => {
    expect(afterEdit('removed', 'new', NOW)(entry())).toBeNull();
  });
});

describe('restored', () => {
  it('takes a refused edit back', () => {
    const before = entry({ pendingText: 'waiting', editedAt: NOW });

    expect(restored(before)(entry({ pendingText: 'new', isChecking: true }))).toEqual(
      entry({ pendingText: 'waiting', editedAt: NOW, isChecking: false })
    );
  });
});

describe('markChecking and markFailed', () => {
  it('keep the failure until the entry is sent again', () => {
    const failure = { code: 'rate_limit', kind: 'retry' } as const;
    const failed = markFailed(failure)(entry({ isChecking: true }));

    expect(failed).toEqual(entry({ isChecking: false, failure }));
    expect(failed && markChecking(failed)).toEqual(entry({ isChecking: true }));
  });
});
