import { describe, expect, it } from 'vitest';
import type { GameReviewEntry } from '@/shared/game-reviews-types';
import { afterEdit, withEdit, withoutPendingEdit } from './reviewEntryUpdates';

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

describe('withEdit', () => {
  it.each([
    [
      'keeps a published text and holds the edit aside',
      'published',
      { pendingText: 'new' },
    ],
    ['replaces an unpublished text', 'pending', { text: 'new' }],
  ] as const)('%s', (_label, moderation, change) => {
    expect(withEdit(entry({ moderation }), 'new')).toEqual(
      entry({ moderation, ...change })
    );
  });
});

describe('afterEdit', () => {
  it.each([
    [
      'a published entry whose edit went through',
      entry(),
      'published',
      entry({ text: 'new', editedAt: NOW }),
    ],
    [
      'a published entry whose edit waits for a moderator',
      entry(),
      'pending',
      entry({ pendingText: 'new' }),
    ],
    [
      'an unpublished entry that got published',
      entry({ moderation: 'pending' }),
      'published',
      entry({ text: 'new' }),
    ],
    [
      'an unpublished entry still waiting',
      entry({ moderation: 'pending' }),
      'pending',
      entry({ moderation: 'pending', text: 'new' }),
    ],
  ] as const)('settles %s', (_label, before, outcome, expected) => {
    expect(afterEdit(outcome, 'new', NOW)(before)).toEqual(expected);
  });

  it('drops an entry moderation removed', () => {
    expect(afterEdit('removed', 'new', NOW)(entry())).toBeNull();
  });
});

describe('withoutPendingEdit', () => {
  it('drops the held edit and keeps the published text', () => {
    expect(withoutPendingEdit(entry({ pendingText: 'new' }))).toEqual(entry());
  });

  it('hands back an entry without a held edit as it is', () => {
    const plain = entry();

    expect(withoutPendingEdit(plain)).toBe(plain);
  });
});
