import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ChangelogEntry } from '../shared/types';

type Handler = (event: unknown, version: string) => Promise<ChangelogEntry[] | null>;

const { fetchMock, handlers } = vi.hoisted(() => ({
  fetchMock: vi.fn(),
  handlers: new Map<string, Handler>(),
}));

vi.mock('electron', () => ({
  ipcMain: {
    handle: (channel: string, handler: Handler) => handlers.set(channel, handler),
  },
  net: { fetch: fetchMock },
}));

const { setupChangelogHandlers } = await import('./changelog');
setupChangelogHandlers();

const fetchChangelog = (version: string) =>
  handlers.get('fetch-changelog')?.(null, version) ?? Promise.resolve(null);

const ENTRY: ChangelogEntry = {
  version: '2.24.0',
  date: '2026-10-01',
  title: 'Release',
  highlights: ['Fix'],
};
const okResponse = () =>
  Promise.resolve({ ok: true, json: () => Promise.resolve([ENTRY]) });

beforeEach(() => {
  fetchMock.mockReset();
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

describe('fetch-changelog', () => {
  it.each([
    ['1.0.0', 'a non-ok response', () => Promise.resolve({ ok: false })],
    ['1.0.1', 'a network error', () => Promise.reject(new Error('offline'))],
  ])('%s: retries after %s and then keeps the result', async (version, _, failure) => {
    fetchMock.mockImplementationOnce(failure).mockImplementation(okResponse);

    expect(await fetchChangelog(version)).toBeNull();
    expect(await fetchChangelog(version)).toEqual([ENTRY]);
    expect(await fetchChangelog(version)).toEqual([ENTRY]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('shares one request between concurrent calls', async () => {
    fetchMock.mockImplementation(okResponse);

    const results = await Promise.all([fetchChangelog('2.0.0'), fetchChangelog('2.0.0')]);

    expect(results).toEqual([[ENTRY], [ENTRY]]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
