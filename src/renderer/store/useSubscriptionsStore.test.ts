import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { t } from '@/shared/i18n/i18n';

vi.stubGlobal('window', {});
const { playNotificationSound } = vi.hoisted(() => ({ playNotificationSound: vi.fn() }));
vi.mock('./useSettingsStore', () => ({
  useSettingsStore: { getState: () => ({ notificationSoundsEnabled: true }) },
}));
vi.mock('../utils/notificationSounds', () => ({ playNotificationSound }));

const { useSubscriptionsStore } = await import('./useSubscriptionsStore');
const { reviewEvent } = await import('../utils/reviewEvent.fixture');
const { notificationMessage } = await import('../utils/notificationMessage');
const store = () => useSubscriptionsStore.getState();

describe('useSubscriptionsStore caps', () => {
  beforeEach(() => {
    useSubscriptionsStore.setState({
      notifications: [],
      unreadCount: 0,
      seenFeedbackReplyIds: [],
      seenModerationEvents: [],
    });
  });

  it('keeps the newest 200 notifications and recounts unread after trimming', () => {
    for (let i = 0; i < 205; i++) {
      store().addFirstFavoriteNotification(`g${i}`, `Game ${i}`, false);
    }
    expect(store().notifications).toHaveLength(200);
    expect(store().notifications[0].gameId).toBe('g204');
    expect(store().notifications.at(-1)?.gameId).toBe('g5');
    expect(store().unreadCount).toBe(200);
  });

  it('keeps the newest 500 seen feedback reply ids', () => {
    for (let i = 0; i < 505; i++) {
      store().addReplyNotification(
        reviewEvent({ kind: 'reply', entryId: `r${i}` }),
        false
      );
    }
    expect(store().seenFeedbackReplyIds).toHaveLength(500);
    expect(store().seenFeedbackReplyIds[0]).toBe('r504');
    expect(store().seenFeedbackReplyIds).not.toContain('r4');
  });

  it('keeps the newest 500 handled moderation events', () => {
    for (let i = 0; i < 505; i++) {
      store().claimModerationEvent(reviewEvent({ entryId: `m${i}` }));
    }
    expect(store().seenModerationEvents).toHaveLength(500);
    expect(store().seenModerationEvents[0]).toMatch(/^m504:/);
  });
});

describe('useSubscriptionsStore showToast', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    playNotificationSound.mockReset();
    useSubscriptionsStore.setState({ notifications: [], unreadCount: 0, toasts: [] });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows the toast with its sound and keeps it out of the list', () => {
    store().showToast({
      type: 'review-rejected',
      gameId: 'g1',
      gameName: 'Game',
      refusalReason: 'banned',
    });

    expect(store().toasts).toEqual([
      expect.objectContaining({
        type: 'review-rejected',
        gameId: 'g1',
        refusalReason: 'banned',
      }),
    ]);
    expect(playNotificationSound).toHaveBeenCalledWith('review-rejected');
    expect(store().notifications).toEqual([]);
    expect(store().unreadCount).toBe(0);
  });

  it('dismisses the toast by itself', () => {
    store().showToast({
      type: 'review-rejected',
      gameId: 'g1',
      gameName: 'Game',
      refusalReason: 'banned',
    });
    vi.runAllTimers();

    expect(store().toasts).toEqual([]);
  });
});

describe('useSubscriptionsStore review notices', () => {
  const reply = reviewEvent({
    kind: 'reply',
    entryId: 'r1',
    authorName: 'Nick',
    message: 'thanks',
  });

  beforeEach(() => {
    vi.useFakeTimers();
    useSubscriptionsStore.setState({
      notifications: [],
      unreadCount: 0,
      toasts: [],
      seenFeedbackReplyIds: [],
      seenModerationEvents: [],
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows a reply as who wrote it and what, linked to its thread and entry', () => {
    store().addReplyNotification(reply, true);

    const link = {
      gameId: 'g1',
      feedbackId: 't',
      entryId: 'r1',
      reply: { authorRole: 'player', authorName: 'Nick', message: 'thanks' },
    };
    expect(store().notifications).toEqual([
      expect.objectContaining({ type: 'feedback-reply', ...link }),
    ]);
    expect(store().toasts).toEqual([expect.objectContaining(link)]);
    expect(notificationMessage(store().notifications[0])).toBe(
      t('notifications.replyBy', { name: 'Nick', message: 'thanks' })
    );
  });

  it('keeps a catch-up reply in the list without a toast', () => {
    expect(store().addReplyNotification(reply, false)).toBe(true);

    expect(store().notifications).toHaveLength(1);
    expect(store().toasts).toEqual([]);
  });

  it('skips a reply an older launcher already showed', () => {
    useSubscriptionsStore.setState({ seenFeedbackReplyIds: ['r1'] });

    expect(store().addReplyNotification(reply, true)).toBe(false);

    expect(store().notifications).toEqual([]);
    expect(store().toasts).toEqual([]);
  });

  it('claims a moderation event once', () => {
    const removed = reviewEvent({ outcome: 'removed' });

    expect(store().claimModerationEvent(removed)).toBe(true);
    expect(store().claimModerationEvent(removed)).toBe(false);
  });

  it('claims each verdict on an entry by its own time', () => {
    expect(
      store().claimModerationEvent(reviewEvent({ at: '2026-10-22T10:07:00Z' }))
    ).toBe(true);
    expect(
      store().claimModerationEvent(
        reviewEvent({ outcome: 'removed', at: '2026-10-22T10:06:00Z' })
      )
    ).toBe(true);
  });

  it('keeps a stored review notice in the list, unlike showToast', () => {
    const notice = {
      type: 'review-rejected' as const,
      gameId: 'g1',
      gameName: 'Game',
      entryId: 'e1',
      refusalReason: 'removed' as const,
    };

    store().addNotification(notice, true);
    store().showToast(notice);

    expect(store().notifications).toEqual([
      expect.objectContaining({
        type: 'review-rejected',
        entryId: 'e1',
        refusalReason: 'removed',
      }),
    ]);
    expect(store().toasts).toEqual([
      expect.objectContaining({ entryId: 'e1', refusalReason: 'removed' }),
      expect.objectContaining({ entryId: 'e1', refusalReason: 'removed' }),
    ]);
  });

  it('marks read only the review notices of the game whose reviews were seen', () => {
    store().addReplyNotification(reply, false);
    store().addNotification(
      { type: 'review-published', gameId: 'g1', gameName: 'Game', entryId: 'e1' },
      false
    );
    store().addReplyNotification(reviewEvent({ kind: 'reply', gameId: 'g2' }), false);
    store().addFirstFavoriteNotification('g1', 'Game', false);
    store().addNotification(
      {
        type: 'review-rejected',
        gameId: 'g1',
        gameName: 'Game',
        entryId: 'e2',
        refusalReason: 'removed',
      },
      false
    );

    store().markGameReviewNoticesAsRead('g1');

    expect(
      store().notifications.map(({ type, gameId, read }) => ({ type, gameId, read }))
    ).toEqual([
      { type: 'review-rejected', gameId: 'g1', read: false },
      { type: 'first-favorite', gameId: 'g1', read: false },
      { type: 'feedback-reply', gameId: 'g2', read: false },
      { type: 'review-published', gameId: 'g1', read: true },
      { type: 'feedback-reply', gameId: 'g1', read: true },
    ]);
    expect(store().unreadCount).toBe(3);
  });

  it('stores a catch-up notice without a toast', () => {
    store().addNotification(
      { type: 'review-published', gameId: 'g1', gameName: 'Game', entryId: 'e1' },
      false
    );

    expect(store().notifications).toHaveLength(1);
    expect(store().toasts).toEqual([]);
  });
});

describe('useSubscriptionsStore stored wording', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useSubscriptionsStore.setState({ notifications: [], unreadCount: 0, toasts: [] });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('keeps progress as its kind and values, worded only when shown', () => {
    store().addProgressChangeNotification('g1', 'Game', 'voice', 10, 40, true);

    const [notification] = store().notifications;
    expect(notification).toEqual(
      expect.objectContaining({ progress: { kind: 'voice', from: 10, to: 40 } })
    );
    expect(notification).not.toHaveProperty('newValue');
    expect(notification).not.toHaveProperty('message');
    expect(notificationMessage(store().toasts[0])).toBe(
      t('notifications.progressChange', {
        kind: t('translationProgress.voice'),
        from: 10,
        to: 40,
      })
    );
  });

  it('keeps a team status as the raw status', () => {
    store().addTeamStatusChangeNotification(
      'g1',
      'Game',
      'Team',
      'planned',
      'completed',
      false
    );

    expect(store().notifications).toEqual([
      expect.objectContaining({ oldValue: 'planned', newValue: 'completed' }),
    ]);
  });

  it('still words a notice an older launcher stored as text', () => {
    useSubscriptionsStore.setState({
      notifications: [
        {
          id: 'old',
          type: 'feedback-reply',
          gameId: 'g1',
          gameName: 'Game',
          message: 'Nick: thanks',
          timestamp: 0,
          read: false,
        },
      ],
    });

    expect(notificationMessage(store().notifications[0])).toBe('Nick: thanks');
  });
});
