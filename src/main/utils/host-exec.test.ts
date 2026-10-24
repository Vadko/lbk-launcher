import type * as ChildProcessModule from 'node:child_process';
import { afterEach, describe, expect, it, vi } from 'vitest';

const spawn = vi.hoisted(() => vi.fn(() => ({ on: vi.fn(), unref: vi.fn() })));
vi.mock('node:child_process', async (importOriginal) => ({
  ...(await importOriginal<typeof ChildProcessModule>()),
  spawn,
}));

const { spawnOnHost } = await import('./host-exec');

afterEach(() => {
  vi.unstubAllEnvs();
  spawn.mockClear();
});

describe('spawnOnHost', () => {
  it('keeps the Steam overlay LD_PRELOAD out of launched programs', () => {
    vi.stubEnv('FLATPAK_ID', '');
    vi.stubEnv(
      'LD_PRELOAD',
      '/home/deck/.local/share/Steam/ubuntu12_64/gameoverlayrenderer.so'
    );
    spawnOnHost('steam', ['-silent'], {
      MILLENNIUM_RUNTIME_PATH: '/x/libmillennium_x86.so',
    });

    expect(spawn).toHaveBeenCalledWith(
      'steam',
      ['-silent'],
      expect.objectContaining({
        env: expect.objectContaining({
          MILLENNIUM_RUNTIME_PATH: '/x/libmillennium_x86.so',
        }),
      })
    );
    expect(spawn).not.toHaveBeenCalledWith(
      'steam',
      ['-silent'],
      expect.objectContaining({
        env: expect.objectContaining({ LD_PRELOAD: expect.anything() }),
      })
    );
  });
});
