import { describe, expect, it } from 'vitest';
import { feedbackSentView } from './feedbackSentView';

describe('feedbackSentView', () => {
  it.each([
    [
      'private feedback, published',
      'feedback',
      false,
      'published',
      'private',
      'feedbackModal.thanks',
      'feedbackModal.sent',
      2000,
    ],
    [
      'private feedback, pending',
      'feedback',
      false,
      'pending',
      'private',
      'feedbackModal.thanks',
      'feedbackModal.sent',
      2000,
    ],
    [
      'private feedback, removed',
      'feedback',
      false,
      'removed',
      'private',
      'feedbackModal.thanks',
      'feedbackModal.sent',
      2000,
    ],
    [
      'private error report',
      'error',
      false,
      'published',
      'private',
      'feedbackModal.thanks_error',
      'feedbackModal.sent_error',
      2000,
    ],
    [
      'public feedback, published',
      'feedback',
      true,
      'published',
      'published',
      'feedbackModal.published',
      'feedbackModal.publishedHint',
      2000,
    ],
    [
      'public error report, pending',
      'error',
      true,
      'pending',
      'pending',
      'feedbackModal.onModeration',
      'gameReviews.hint.moderation',
      5000,
    ],
    [
      'public feedback, removed',
      'feedback',
      true,
      'removed',
      'removed',
      'feedbackModal.removedByModeration',
      'feedbackModal.removedHint',
      5000,
    ],
  ] as const)(
    '%s',
    (_label, type, allowPublish, outcome, screen, title, text, closeAfterMs) => {
      expect(feedbackSentView(type, allowPublish, outcome)).toEqual({
        screen,
        title,
        text,
        closeAfterMs,
      });
    }
  );

  it.each([
    ['feedback', 'published'],
    ['feedback', 'pending'],
    ['feedback', 'removed'],
    ['error', 'published'],
    ['error', 'pending'],
    ['error', 'removed'],
  ] as const)(
    'never tells a public %s post that was %s it went to the translation creator',
    (type, outcome) => {
      const view = feedbackSentView(type, true, outcome);

      expect([view.title, view.text]).not.toEqual(
        expect.arrayContaining([
          expect.stringMatching(/^feedbackModal\.(thanks|sent)(_error)?$/),
        ])
      );
    }
  );
});
