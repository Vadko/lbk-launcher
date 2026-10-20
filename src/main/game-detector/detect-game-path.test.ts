import { beforeEach, describe, expect, it, vi } from 'vitest';
import { detectGamePath } from './index';
import { findSteamGame, findSteamGameByAppId } from './steam';

vi.mock('../api', () => ({ fetchGames: vi.fn(), fetchGamesByIds: vi.fn() }));

vi.mock('./steam', () => ({
  findSteamGame: vi.fn(),
  findSteamGameByAppId: vi.fn(),
}));

const OXYGEN_APP_ID = 387990;
const OXYGEN_FOLDER = 'C:\\Steam\\steamapps\\common\\OxygenNotIncluded';

describe('detectGamePath', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('resolves a Steam entry with no folder name by app id', () => {
    vi.mocked(findSteamGameByAppId).mockReturnValue(OXYGEN_FOLDER);

    expect(detectGamePath({ type: 'steam', path: '' }, OXYGEN_APP_ID)).toEqual({
      platform: 'steam',
      path: OXYGEN_FOLDER,
      exists: true,
    });
    expect(findSteamGameByAppId).toHaveBeenCalledWith(OXYGEN_APP_ID);
  });

  it('reports a Steam entry with no folder name as missing when the app id is not installed', () => {
    vi.mocked(findSteamGameByAppId).mockReturnValue(null);

    expect(detectGamePath({ type: 'steam', path: '' }, OXYGEN_APP_ID)).toEqual({
      platform: 'steam',
      path: '',
      exists: false,
    });
  });

  it.each([
    ['null', null],
    ['undefined', undefined],
  ])('returns null for an empty Steam folder with app id %s', (_, steamAppId) => {
    expect(detectGamePath({ type: 'steam', path: '' }, steamAppId)).toBeNull();
    expect(findSteamGameByAppId).not.toHaveBeenCalled();
    expect(findSteamGame).not.toHaveBeenCalled();
  });

  it('resolves a named Steam folder through findSteamGame', () => {
    vi.mocked(findSteamGame).mockReturnValue(OXYGEN_FOLDER);

    expect(
      detectGamePath({ type: 'steam', path: 'OxygenNotIncluded' }, OXYGEN_APP_ID)
    ).toEqual({ platform: 'steam', path: OXYGEN_FOLDER, exists: true });
    expect(findSteamGame).toHaveBeenCalledWith('OxygenNotIncluded', OXYGEN_APP_ID);
  });
});
