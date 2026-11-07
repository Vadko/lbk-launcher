import { describe, expect, it, vi } from 'vitest';
import type { InstallationInfo } from '../../shared/types';

vi.mock('./useStore', async () => {
  const { create } = await import('zustand');
  return {
    useStore: create(() => ({
      installedTranslations: new Map<string, Pick<InstallationInfo, 'hasInstallError'>>([
        ['a', { hasInstallError: false }],
        ['b', { hasInstallError: true }],
        ['c', { hasInstallError: false }],
      ]),
    })),
  };
});
vi.mock('./useWorkshopInstallsStore', async () => {
  const { create } = await import('zustand');
  return {
    useWorkshopInstallsStore: create(() => ({
      installedAt: { w: '2026-11-01T00:00:00Z' } as Record<string, string>,
    })),
  };
});

const writes: string[] = [];
vi.stubGlobal('window', {
  storeStorage: {
    getItem: (key: string) => (key === '__migration-v1-done' ? 'true' : null),
    setItem: (key: string) => writes.push(key),
    removeItem: vi.fn(),
  },
});

const { useStore } = await import('./useStore');
const { useWorkshopInstallsStore } = await import('./useWorkshopInstallsStore');
const { useEverInstalledStore } = await import('./useEverInstalledStore');
const { initEverInstalled } = await import('./everInstalledBridge');
initEverInstalled();

const everInstalled = () => Object.keys(useEverInstalledStore.getState().installedAt);
const persistWrites = () =>
  writes.filter((key) => key === 'ever-installed-storage').length;

describe('initEverInstalled', () => {
  it('marks every installed translation but a failed one, in one persist write', () => {
    expect(everInstalled()).toEqual(['a', 'c', 'w']);
    expect(persistWrites()).toBe(1);
  });

  it.each([
    ['a file install', () => useStore.setState({ installedTranslations: new Map() })],
    ['a Workshop install', () => useWorkshopInstallsStore.setState({ installedAt: {} })],
  ])('keeps a translation after %s is gone, and writes nothing for it', (_, remove) => {
    writes.length = 0;

    remove();

    expect(everInstalled()).toEqual(['a', 'c', 'w']);
    expect(persistWrites()).toBe(0);
  });

  it('marks a translation installed later, and keeps the first install time', () => {
    const before = useEverInstalledStore.getState().installedAt.a;
    writes.length = 0;

    useWorkshopInstallsStore.setState({ installedAt: { x: '2026-11-07T00:00:00Z' } });

    expect(everInstalled()).toEqual(['a', 'c', 'w', 'x']);
    expect(useEverInstalledStore.getState().installedAt.a).toBe(before);
    expect(persistWrites()).toBe(1);
  });
});
