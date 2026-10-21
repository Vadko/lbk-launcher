import type * as FsModule from 'fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type * as XboxModule from './xbox';

vi.mock('../utils/platform', () => ({
  isLinux: () => false,
  isMacOS: () => false,
  isWindows: () => true,
}));

type Marker = Buffer | (() => Promise<Buffer | null>);

const disk = vi.hoisted(() => ({
  // Drive letter -> .GamingRoot content, or a function that controls when the read settles
  markers: new Map<string, Marker>(),
  readCalls: [] as string[],
}));

vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal<typeof FsModule>();
  return {
    ...actual,
    promises: {
      ...actual.promises,
      readFile: async (file: string) => {
        const drive = file.slice(0, 2);
        disk.readCalls.push(drive);
        const marker = disk.markers.get(drive);
        const content = typeof marker === 'function' ? await marker() : marker;
        if (!content) {
          throw new Error('ENOENT');
        }
        return content;
      },
      access: (file: string) =>
        disk.markers.has(file.slice(0, 2))
          ? Promise.resolve()
          : Promise.reject(new Error('ENOENT')),
    },
  };
});

function gamingRoot(folder: string): Buffer {
  const header = Buffer.alloc(8);
  header.write('RGBX', 0, 'ascii');
  header.writeUInt32LE(1, 4);
  return Buffer.concat([header, Buffer.from(`${folder}\0`, 'utf16le')]);
}

// A read that stays pending until the test settles it, like a spinning-up disk or a dead share
function slowRead() {
  let settle: (content: Buffer | null) => void = () => undefined;
  const read = new Promise<Buffer | null>((resolve) => {
    settle = resolve;
  });
  return { read: () => read, settle };
}

const rootDrives = () => xbox.getXboxRootPaths().map((root) => root.slice(0, 2));
const flush = () => new Promise((resolve) => setTimeout(resolve, 50));

let xbox: typeof XboxModule;

beforeEach(async () => {
  vi.resetModules();
  disk.markers.clear();
  disk.readCalls.length = 0;
  disk.markers.set('D:', gamingRoot('XboxGames'));
  xbox = await import('./xbox');
});

describe('Xbox roots', { timeout: 20_000 }, () => {
  it('answers sync callers right away and fills in roots from the background scan', async () => {
    const listener = vi.fn();
    xbox.onXboxRootsChanged(listener);

    expect(xbox.getXboxRootPaths()).toEqual([]);
    await xbox.whenXboxRootsScanned();

    expect(rootDrives()).toEqual(['D:']);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('shares one scan between concurrent callers', async () => {
    await Promise.all([xbox.refreshXboxRoots(), xbox.refreshXboxRoots()]);
    expect(disk.readCalls.filter((drive) => drive === 'D:')).toHaveLength(1);
  });

  it('reports no change when a rescan finds the same roots', async () => {
    expect(await xbox.refreshXboxRoots()).toBe(true);
    expect(await xbox.refreshXboxRoots()).toBe(false);
  });

  it('brings back a slow drive once it answers, without blacklisting it', async () => {
    const usb = slowRead();
    disk.markers.set('E:', usb.read);

    const started = Date.now();
    await xbox.refreshXboxRoots();
    expect(Date.now() - started).toBeLessThan(3000);
    expect(rootDrives()).toEqual(['D:']);

    usb.settle(gamingRoot('XboxGames'));
    await flush();
    await xbox.refreshXboxRoots();
    expect(rootDrives()).toEqual(['D:', 'E:']);
  });

  it('keeps known roots of a drive that turns slow', async () => {
    await xbox.refreshXboxRoots();
    expect(rootDrives()).toEqual(['D:']);

    disk.markers.set('D:', slowRead().read);
    expect(await xbox.refreshXboxRoots()).toBe(false);
    expect(rootDrives()).toEqual(['D:']);
  });

  it('skips a slow drive that failed until resume retries it', async () => {
    const share = slowRead();
    disk.markers.set('Z:', share.read);
    await xbox.refreshXboxRoots();

    share.settle(null);
    await flush();
    disk.readCalls.length = 0;
    await xbox.refreshXboxRoots();
    expect(disk.readCalls).not.toContain('Z:');

    disk.markers.set('Z:', gamingRoot('XboxGames'));
    await xbox.refreshXboxRoots({ retryDeadDrives: true });
    expect(rootDrives()).toEqual(['D:', 'Z:']);
  });

  it('stops probing once two drives hang, leaving threads for the rest of the app', async () => {
    for (const drive of ['W:', 'X:', 'Y:']) {
      disk.markers.set(drive, slowRead().read);
    }
    await xbox.refreshXboxRoots();
    expect(disk.readCalls).toContain('W:');
    expect(disk.readCalls).toContain('X:');
    expect(disk.readCalls).not.toContain('Y:');
  });
});
