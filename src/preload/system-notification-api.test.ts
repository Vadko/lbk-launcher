import { beforeEach, describe, expect, it, vi } from 'vitest';

type IpcHandler = (event: unknown, payload: unknown) => void;

const ipcRenderer = vi.hoisted(() => ({
  invoke: vi.fn(),
  on: vi.fn(),
  removeListener: vi.fn(),
}));

vi.mock('electron', () => ({ ipcRenderer }));

const { systemNotificationAPI } = await import('./system-notification-api');

const TARGET = {
  gameId: 'game-1',
  feedbackId: '0b6f3f0e-5c1a-4d2e-9f3b-2a1c4d5e6f70',
  entryId: '3d2c1b0a-9f8e-4d7c-8b6a-5f4e3d2c1b0a',
};

beforeEach(() => {
  ipcRenderer.invoke.mockReset();
  ipcRenderer.on.mockReset();
  ipcRenderer.removeListener.mockReset();
});

describe('system notification preload', () => {
  it('sends the review entry a click leads to along with the game', async () => {
    ipcRenderer.invoke.mockResolvedValue(true);

    await expect(
      systemNotificationAPI.showSystemNotification({
        title: 'Game',
        body: 'text',
        target: TARGET,
      })
    ).resolves.toBe(true);

    expect(ipcRenderer.invoke).toHaveBeenCalledWith('show-system-notification', {
      title: 'Game',
      body: 'text',
      target: TARGET,
    });
  });

  it('hands the clicked target to the listener without the IPC event', () => {
    const callback = vi.fn();
    const dispose = systemNotificationAPI.onNavigateToGame(callback);
    const [channel, handler] = ipcRenderer.on.mock.calls[0] as [string, IpcHandler];

    handler({ sender: 'main' }, TARGET);

    expect(channel).toBe('navigate-to-game');
    expect(callback).toHaveBeenCalledWith(TARGET);

    dispose();

    expect(ipcRenderer.removeListener).toHaveBeenCalledWith('navigate-to-game', handler);
  });
});
