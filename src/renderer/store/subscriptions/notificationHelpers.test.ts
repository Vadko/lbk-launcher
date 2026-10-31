import { beforeEach, describe, expect, it, vi } from 'vitest';

const windowControls = vi.hoisted(() => ({
  isVisible: vi.fn(),
  showSystemNotification: vi.fn(),
}));

vi.stubGlobal('window', { windowControls });
vi.mock('../useSettingsStore', () => ({
  useSettingsStore: { getState: () => ({ notificationSoundsEnabled: false }) },
}));
vi.mock('../../utils/notificationSounds', () => ({ playNotificationSound: vi.fn() }));

const { showSystemNotificationIfHidden } = await import('./notificationHelpers');

const THREAD = '0b6f3f0e-5c1a-4d2e-9f3b-2a1c4d5e6f70';
const ENTRY = '3d2c1b0a-9f8e-4d7c-8b6a-5f4e3d2c1b0a';

beforeEach(() => {
  windowControls.isVisible.mockReset();
  windowControls.showSystemNotification.mockReset();
});

describe('showSystemNotificationIfHidden', () => {
  it('sends only the link fields of a review notice from the tray', async () => {
    windowControls.isVisible.mockResolvedValue(false);

    await showSystemNotificationIfHidden('Game', 'text', {
      gameId: 'game-1',
      feedbackId: THREAD,
      entryId: ENTRY,
      // A whole notice is passed in, and its other fields stay in the renderer
      ...{ id: 'n1', type: 'feedback-reply', read: false },
    });

    expect(windowControls.showSystemNotification).toHaveBeenCalledWith({
      title: 'Game',
      body: 'text',
      target: { gameId: 'game-1', feedbackId: THREAD, entryId: ENTRY },
    });
  });

  it('sends no target for a notice without a game', async () => {
    windowControls.isVisible.mockResolvedValue(false);

    await showSystemNotificationIfHidden('LBK Launcher', 'text');

    expect(windowControls.showSystemNotification).toHaveBeenCalledWith({
      title: 'LBK Launcher',
      body: 'text',
      target: undefined,
    });
  });

  it('stays quiet while the window is shown', async () => {
    windowControls.isVisible.mockResolvedValue(true);

    await showSystemNotificationIfHidden('Game', 'text', { gameId: 'game-1' });

    expect(windowControls.showSystemNotification).not.toHaveBeenCalled();
  });
});
