import { describe, expect, it } from 'vitest';
import { feedbackSentView } from './feedbackSentView';

describe('feedbackSentView', () => {
  it.each([
    ['private published', false, 'published', 'private', 'feedbackModal.sent', 2000],
    ['private pending', false, 'pending', 'private', 'feedbackModal.sent', 2000],
    ['private removed', false, 'removed', 'private', 'feedbackModal.sent', 2000],
    [
      'public published',
      true,
      'published',
      'published',
      'feedbackModal.publishedHint',
      2000,
    ],
    ['public pending', true, 'pending', 'pending', 'gameReviews.hint.moderation', 5000],
    ['public removed', true, 'removed', 'removed', 'feedbackModal.removedHint', 5000],
  ] as const)('%s', (_label, allowPublish, outcome, screen, text, closeAfterMs) => {
    expect(feedbackSentView(allowPublish, outcome)).toMatchObject({
      screen,
      text,
      closeAfterMs,
    });
  });

  it.each(['published', 'pending', 'removed'] as const)(
    'never tells a public %s post it went to the translation creator',
    (outcome) => {
      const view = feedbackSentView(true, outcome);

      expect([view.title, view.text]).not.toContain('feedbackModal.sent');
      expect([view.title, view.text]).not.toContain('feedbackModal.thanks');
    }
  );
});
