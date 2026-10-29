import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.stubGlobal('window', {});
const { playNotificationSound } = vi.hoisted(() => ({ playNotificationSound: vi.fn() }));
vi.mock('./useSettingsStore', () => ({
  useSettingsStore: { getState: () => ({ notificationSoundsEnabled: true }) },
}));
vi.mock('../utils/notificationSounds', () => ({ playNotificationSound }));

const { useSubscriptionsStore } = await import('./useSubscriptionsStore');
const store = () => useSubscriptionsStore.getState();

describe('useSubscriptionsStore caps', () => {
  beforeEach(() => {
    useSubscriptionsStore.setState({
      notifications: [],
      unreadCount: 0,
      seenFeedbackReplyIds: [],
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
      store().addFeedbackReplyNotification(
        {
          replyId: `r${i}`,
          gameId: 'g',
          gameName: 'Game',
          message: 'hi',
          createdAt: '2026-01-01T00:00:00Z',
        },
        false
      );
    }
    expect(store().seenFeedbackReplyIds).toHaveLength(500);
    expect(store().seenFeedbackReplyIds[0]).toBe('r504');
    expect(store().seenFeedbackReplyIds).not.toContain('r4');
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
      message: 'refused',
    });

    expect(store().toasts).toEqual([
      expect.objectContaining({
        type: 'review-rejected',
        gameId: 'g1',
        message: 'refused',
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
      message: 'refused',
    });
    vi.runAllTimers();

    expect(store().toasts).toEqual([]);
  });
});
