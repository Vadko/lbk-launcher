import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeElectronApi } from './bridgeApi.fixture';

vi.mock('./useStore', async () => {
  const { create } = await import('zustand');
  return { useStore: create(() => ({ syncStatus: 'loading' })) };
});

const getStoreDiscounts = vi.fn(() => Promise.resolve([]));
const { api, emit } = fakeElectronApi({ getStoreDiscounts });
vi.stubGlobal('window', { electronAPI: api });
vi.useFakeTimers();

const { useStore } = await import('./useStore');
const { initStoreDiscounts } = await import('./storeDiscountsBridge');
initStoreDiscounts();

beforeEach(async () => {
  useStore.setState({ syncStatus: 'loading' });
  await vi.runAllTimersAsync();
  getStoreDiscounts.mockClear();
});

describe('initStoreDiscounts', () => {
  it.each([
    'onStoreDiscountsUpdated',
    'onSteamLibraryChanged',
    'onStoreLibraryChanged',
    'onGameUpdated',
    'onGameRemoved',
  ])('reads the discounts again, once per burst, on %s', async (event) => {
    emit(event);
    emit(event);
    await vi.advanceTimersByTimeAsync(300);

    expect(getStoreDiscounts).toHaveBeenCalledOnce();
  });

  it.each([
    ['ready', 1],
    ['error', 1],
    ['syncing', 0],
  ] as const)(
    'reads again when the sync turns %s: %i read',
    async (syncStatus, reads) => {
      useStore.setState({ syncStatus });
      await vi.advanceTimersByTimeAsync(300);

      expect(getStoreDiscounts).toHaveBeenCalledTimes(reads);
    }
  );
});
