import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchSteamLibraryFromApi } from './steam-library-api';

const invoke = vi.hoisted(() => vi.fn());

vi.mock('electron', () => ({ app: { getPath: () => '' } }));
vi.mock('./tracking', () => ({ getMachineId: () => 'machine' }));
vi.mock('./db/supabase-client', () => ({
  getSupabaseClient: () => ({ functions: { invoke } }),
}));

beforeEach(() => {
  invoke.mockReset();
  invoke.mockResolvedValue({
    data: { success: true, appIds: [620], remaining: 9 },
    error: null,
  });
});

describe('fetchSteamLibraryFromApi', () => {
  it.each([
    ['the base SteamID64 (account 0)', '76561197960265728'],
    ['a Steam3 id', '126948360'],
    ['an empty id', ''],
  ])('sends no request for %s', async (_, steamId) => {
    await expect(fetchSteamLibraryFromApi(steamId)).resolves.toBeNull();
    expect(invoke).not.toHaveBeenCalled();
  });

  it('asks the edge function for a real account', async () => {
    await expect(fetchSteamLibraryFromApi('76561198087214088')).resolves.toEqual({
      appIds: [620],
      remaining: 9,
    });
    expect(invoke).toHaveBeenCalledExactlyOnceWith(
      'steam-library?steam_id=76561198087214088&machine_id=machine',
      { method: 'GET' }
    );
  });
});
