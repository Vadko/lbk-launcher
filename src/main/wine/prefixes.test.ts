import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  store: new Map<string, unknown>(),
  emit: vi.fn(),
  bottles: [] as string[],
}));

vi.mock('@/main/app-events', () => ({ appEvents: { emit: mocks.emit } }));
vi.mock('@/main/utils/platform', () => ({ isMacOS: () => true }));
vi.mock('@/main/utils/store-storage', () => ({
  readStoreValue: (key: string) => mocks.store.get(key),
  writeStoreValue: (key: string, value: unknown) => mocks.store.set(key, value),
}));
vi.mock('./crossover', () => ({
  crossOverBottleDirs: () => ['/no-such-bottle-dir'],
  listBottlesIn: () => mocks.bottles,
  isCrossOverBottle: () => false,
  readCrossOverBottleDirDefault: () => Promise.resolve(null),
}));

let root: string;
let prefix: string;

beforeAll(() => {
  root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'lbk-wine-prefixes-')));
  prefix = path.join(root, 'Bottle');
  fs.mkdirSync(path.join(prefix, 'drive_c', 'users'), { recursive: true });
  fs.writeFileSync(path.join(prefix, 'system.reg'), '');
});

afterAll(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

beforeEach(() => {
  vi.resetModules();
  vi.restoreAllMocks();
  mocks.store.clear();
  mocks.emit.mockClear();
  mocks.bottles = [];
  vi.spyOn(console, 'log').mockImplementation(() => undefined);
});

// lru-cache keeps a reading of performance.now() for 1 ms, so the clock moves only after that
async function expireSnapshot(): Promise<void> {
  const now = performance.now() + 60_000;
  vi.spyOn(performance, 'now').mockReturnValue(now);
  await sleep(5);
}

async function startedPrefixes() {
  const prefixes = await import('./prefixes');
  await prefixes.startWinePrefixes();
  return prefixes;
}

describe('wine prefixes', () => {
  it('announces a prefix added after the snapshot expired', async () => {
    const { addUserWinePrefix, listWinePrefixes } = await startedPrefixes();
    await expireSnapshot();

    const result = addUserWinePrefix(path.join(prefix, 'drive_c', 'users'));

    expect(result).toMatchObject({
      success: true,
      prefix: { prefix, launcher: 'manual' },
    });
    expect(listWinePrefixes().map((ref) => ref.prefix)).toEqual([prefix]);
    expect(mocks.emit).toHaveBeenCalledExactlyOnceWith('wine-prefixes-changed');
  });

  it('announces a removed prefix', async () => {
    const { addUserWinePrefix, removeUserWinePrefix } = await startedPrefixes();
    addUserWinePrefix(prefix);
    mocks.emit.mockClear();

    removeUserWinePrefix(prefix);

    expect(mocks.emit).toHaveBeenCalledExactlyOnceWith('wine-prefixes-changed');
  });

  it('stays quiet on the start itself', async () => {
    await startedPrefixes();

    expect(mocks.emit).not.toHaveBeenCalled();
  });

  it('stays quiet when a listed prefix is added again', async () => {
    const { addUserWinePrefix } = await startedPrefixes();
    addUserWinePrefix(prefix);
    mocks.emit.mockClear();

    addUserWinePrefix(prefix);

    expect(mocks.emit).not.toHaveBeenCalled();
  });

  it('keeps no entry for a bottle it already finds', async () => {
    mocks.bottles = [prefix];
    const { addUserWinePrefix } = await startedPrefixes();

    expect(addUserWinePrefix(prefix)).toMatchObject({ success: true });
    expect(mocks.store.get('wine-prefixes')).toBeUndefined();
    expect(mocks.emit).not.toHaveBeenCalled();
  });

  it('refuses a folder outside any prefix', async () => {
    const { addUserWinePrefix } = await startedPrefixes();

    expect(addUserWinePrefix(root)).toEqual({ success: false, error: 'not-a-prefix' });
    expect(mocks.emit).not.toHaveBeenCalled();
  });
});
