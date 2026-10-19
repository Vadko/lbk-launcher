import { beforeEach, describe, expect, it, vi } from 'vitest';
import type * as OpenExternalModule from './open-external';

const host = vi.hoisted(() => ({
  xdgDefault: '',
  installed: new Set<string>(),
  probes: [] as string[],
  spawn: vi.fn(() => ({ unref: () => undefined })),
  openExternal: vi.fn(() => Promise.resolve()),
}));

vi.mock('child_process', () => ({
  execFile: Object.assign(vi.fn(), {
    [Symbol.for('nodejs.util.promisify.custom')]: (command: string, args: string[]) => {
      const probe = [command, ...args].join(' ');
      host.probes.push(probe);
      if (command === 'xdg-settings' && host.xdgDefault) {
        return Promise.resolve({ stdout: `${host.xdgDefault}\n`, stderr: '' });
      }
      return host.installed.has(probe)
        ? Promise.resolve({ stdout: '', stderr: '' })
        : Promise.reject(new Error('not found'));
    },
  }),
  spawn: host.spawn,
}));

vi.mock('electron', () => ({ shell: { openExternal: host.openExternal } }));

vi.mock('./platform', () => ({ isLinux: () => true }));

let openExternalUrl: typeof OpenExternalModule.openExternalUrl;

beforeEach(async () => {
  vi.resetModules();
  host.xdgDefault = '';
  host.installed.clear();
  host.probes.length = 0;
  host.spawn.mockClear();
  host.openExternal.mockClear();
  ({ openExternalUrl } = await import('./open-external'));
});

describe('openExternalUrl on Linux', () => {
  it('opens the xdg default Flatpak browser, probing once for concurrent clicks', async () => {
    host.xdgDefault = 'org.mozilla.firefox.desktop';
    host.installed.add('flatpak info org.mozilla.firefox');

    const results = await Promise.all([
      openExternalUrl('https://a.test'),
      openExternalUrl('https://b.test'),
    ]);

    expect(results).toEqual([{ success: true }, { success: true }]);
    expect(host.probes).toEqual([
      'xdg-settings get default-web-browser',
      'flatpak info org.mozilla.firefox',
    ]);
    expect(host.spawn).toHaveBeenCalledWith(
      'flatpak',
      ['run', 'org.mozilla.firefox', 'https://b.test'],
      expect.anything()
    );
  });

  it('falls back to the Flatpak list, then native binaries, in order', async () => {
    host.installed.add('which chromium');

    await openExternalUrl('https://a.test');

    expect(host.probes).toEqual([
      'xdg-settings get default-web-browser',
      'flatpak info org.mozilla.firefox',
      'flatpak info com.google.Chrome',
      'flatpak info org.chromium.Chromium',
      'flatpak info com.brave.Browser',
      'which firefox',
      'which chromium',
    ]);
    expect(host.spawn).toHaveBeenCalledWith(
      'chromium',
      ['https://a.test'],
      expect.anything()
    );
  });

  it('hands the URL to shell.openExternal when no browser is found', async () => {
    expect(await openExternalUrl('https://a.test')).toEqual({ success: true });
    expect(host.spawn).not.toHaveBeenCalled();
    expect(host.openExternal).toHaveBeenCalledWith('https://a.test');
  });
});
