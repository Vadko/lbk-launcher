import { beforeEach, describe, expect, it, vi } from 'vitest';
import { detectGamePath } from './index';
import { findSteamGame } from './steam';

vi.mock('../api', () => ({ fetchGames: vi.fn(), fetchGamesByIds: vi.fn() }));

vi.mock('./steam', () => ({
  findSteamGame: vi.fn(),
}));

const OXYGEN_APP_ID = 387990;
const OXYGEN_FOLDER = 'C:\\Steam\\steamapps\\common\\OxygenNotIncluded';

describe('detectGamePath', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each([
    ['no folder name', ''],
    ['a named folder', 'OxygenNotIncluded'],
  ])('resolves a Steam entry with %s through findSteamGame', (_, folder) => {
    vi.mocked(findSteamGame).mockReturnValue(OXYGEN_FOLDER);

    expect(detectGamePath({ type: 'steam', path: folder }, OXYGEN_APP_ID)).toEqual({
      platform: 'steam',
      path: OXYGEN_FOLDER,
      exists: true,
    });
    expect(findSteamGame).toHaveBeenCalledWith(folder, OXYGEN_APP_ID);
  });

  it('reports a Steam entry with no folder name as missing when the app id is not installed', () => {
    vi.mocked(findSteamGame).mockReturnValue(null);

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
    expect(findSteamGame).not.toHaveBeenCalled();
  });

  it('returns null for a non-Steam entry with no folder name even with an app id', () => {
    expect(detectGamePath({ type: 'gog', path: '' }, OXYGEN_APP_ID)).toBeNull();
  });
});
