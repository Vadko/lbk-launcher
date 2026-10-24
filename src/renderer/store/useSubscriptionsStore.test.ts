import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.stubGlobal('window', {});
vi.mock('./useSettingsStore', () => ({ useSettingsStore: { getState: () => ({}) } }));
vi.mock('../utils/notificationSounds', () => ({ playNotificationSound: vi.fn() }));

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
