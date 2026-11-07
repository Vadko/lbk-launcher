import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DeckyInfo } from '@/main/utils/decky';

const decky = vi.hoisted(() => ({
  // What detectDecky()'s cache still holds, and what a fresh probe would see.
  cached: null as boolean | null,
  live: false,
  liveAfterDownload: false,
  downloaded: false,
}));
const spawn = vi.hoisted(() => vi.fn());

function info(running: boolean): DeckyInfo {
  return {
    installed: true,
    running,
    homebrewDir: '/home/deck/homebrew',
    plugin: { installed: false, dir: null, version: null, disabled: false },
  };
}

function seen(): boolean {
  if (decky.cached !== null) {
    return decky.cached;
  }
  return decky.downloaded ? decky.liveAfterDownload : decky.live;
}

vi.mock('node:child_process', () => ({ spawn }));
vi.mock('@/main/plugin-host/bridge-plugin-setup', () => ({
  syncBridgePluginSetup: () => Promise.resolve(),
}));
vi.mock('@/main/plugin-host/decky-watcher', () => ({ watchDeckyPlugins: vi.fn() }));
vi.mock('@/main/plugin-host/state', () => ({
  deckyLoaderStateFor: (snapshot: { decky: DeckyInfo }) =>
    snapshot.decky.running ? null : { installing: false, blockedBy: null, repair: true },
  getHostSnapshot: () => Promise.resolve({ decky: info(seen()) }),
  publishPluginHostState: () => Promise.resolve(),
  resetHostFacts: () => {
    decky.cached = null;
  },
  setDeckyLoaderInstalling: vi.fn(),
}));
vi.mock('@/main/utils/decky', () => ({
  deckyCacheDirFor: () => '/home/deck/.cache/lbk-launcher/decky',
  detectDecky: () => Promise.resolve(info(seen())),
  resetDeckyDetectCache: () => {
    decky.cached = null;
  },
}));
vi.mock('@/main/utils/host-exec', () => ({
  getCleanEnv: () => ({}),
  isFlatpak: () => false,
}));
vi.mock('@/main/utils/pinned-download', () => ({
  downloadPinned: () => {
    decky.downloaded = true;
    return Promise.resolve();
  },
  PinnedDownloadError: class extends Error {},
}));

const { installDeckyLoader } = await import('./decky-loader-install');

beforeEach(() => {
  spawn.mockClear();
  Object.assign(decky, {
    cached: null,
    live: false,
    liveAfterDownload: false,
    downloaded: false,
  });
  vi.spyOn(console, 'log').mockImplementation(() => undefined);
});

describe('installDeckyLoader', () => {
  it.each([
    ['the cache still says it is down', { cached: false, live: true }],
    ['it came up during the download', { live: false, liveAfterDownload: true }],
  ])('never runs the installer on a working Decky when %s', async (_label, state) => {
    Object.assign(decky, state);
    expect(await installDeckyLoader()).toEqual({ success: true });
    expect(spawn).not.toHaveBeenCalled();
  });
});
