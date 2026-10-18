import { afterEach, describe, expect, it, vi } from 'vitest';
import { appEvents } from './app-events';

describe('appEvents', () => {
  afterEach(() => {
    appEvents.removeAllListeners('install-record-removed');
    vi.restoreAllMocks();
  });

  it('logs a failing async listener and still runs the others', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const failure = new Error('listener failed');
    const seen: string[] = [];
    appEvents.on('install-record-removed', () => Promise.reject(failure));
    appEvents.on('install-record-removed', (gameId) => {
      seen.push(gameId);
    });

    expect(() => appEvents.emit('install-record-removed', 'g')).not.toThrow();
    expect(seen).toEqual(['g']);
    await vi.waitFor(() =>
      expect(warn).toHaveBeenCalledWith('[Main] App event listener failed:', failure)
    );
  });
});
