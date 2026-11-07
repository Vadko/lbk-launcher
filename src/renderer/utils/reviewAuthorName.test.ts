import { describe, expect, it } from 'vitest';
import type { GameReviewAuthor } from '@/shared/game-reviews-types';
import { t } from '@/shared/i18n/i18n';
import { reviewAuthorName } from './reviewAuthorName';

describe('reviewAuthorName', () => {
  it.each<[string, GameReviewAuthor['role'], string | null, string | null]>([
    ['a player by the nickname', 'player', 'Nick', 'Nick'],
    ['no player without a nickname', 'player', null, null],
    ['an author by the team', 'author', 'Team', 'Team'],
    [
      'an author without a team by the role',
      'author',
      null,
      t('gameReviews.translationAuthor'),
    ],
    ['staff as the moderator', 'moderator', null, t('gameReviews.moderator')],
  ])('names %s', (_case, role, name, expected) => {
    expect(reviewAuthorName(role, name)).toBe(expected);
  });
});
