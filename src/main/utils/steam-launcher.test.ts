import * as os from 'node:os';
import * as path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { currentLinuxSteamType } from '@/main/utils/steam-launcher';

vi.mock('@/main/game-detector/steam', () => ({
  getSteamExePath: () => null,
  getSteamPath: () => null,
}));

describe('currentLinuxSteamType', () => {
  it('takes the flavour from the found Steam path, not from leftover Flatpak data', () => {
    const home = os.homedir();
    // steamTypeFromPath() compares with path.posix, also on a Windows host.
    expect(currentLinuxSteamType(path.posix.join(home, '.local/share/Steam'))).toBe(
      'native'
    );
    expect(
      currentLinuxSteamType(
        path.posix.join(home, '.var/app/com.valvesoftware.Steam/data/Steam')
      )
    ).toBe('flatpak');
    expect(
      currentLinuxSteamType(path.posix.join(home, 'snap/steam/common/.steam/steam'))
    ).toBe('snap');
  });
});
