import { describe, expect, it } from 'vitest';
import { t } from '@/shared/i18n/i18n';
import { reviewEvent } from './reviewEvent.fixture';
import { reviewReplyText } from './reviewReplyText';

const reply = (extra: Parameters<typeof reviewEvent>[0]) =>
  reviewEvent({ kind: 'reply', message: 'thanks', ...extra });

describe('reviewReplyText', () => {
  it('names a player by the nickname', () => {
    expect(reviewReplyText(reply({ authorRole: 'player', authorName: 'Nick' }))).toBe(
      t('notifications.replyBy', { name: 'Nick', message: 'thanks' })
    );
  });

  it('names an author by the team', () => {
    expect(reviewReplyText(reply({ authorRole: 'author', authorName: 'Team' }))).toBe(
      t('notifications.replyBy', { name: 'Team', message: 'thanks' })
    );
  });

  it('names an author without a team by the role', () => {
    expect(reviewReplyText(reply({ authorRole: 'author', authorName: null }))).toBe(
      t('notifications.replyBy', {
        name: t('gameReviews.translationAuthor'),
        message: 'thanks',
      })
    );
  });

  it('names staff as the moderator, since they come unnamed', () => {
    expect(reviewReplyText(reply({ authorRole: 'moderator', authorName: null }))).toBe(
      t('notifications.replyBy', { name: t('gameReviews.moderator'), message: 'thanks' })
    );
  });

  it('shows the bare text for a player without a nickname', () => {
    expect(reviewReplyText(reply({ authorRole: 'player', authorName: null }))).toBe(
      'thanks'
    );
  });

  it('keeps the text as written', () => {
    expect(reviewReplyText(reply({ authorName: 'A&B', message: '<b> & "x"' }))).toBe(
      'A&B: <b> & "x"'
    );
  });
});
