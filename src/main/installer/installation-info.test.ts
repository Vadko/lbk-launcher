import { describe, expect, it, vi } from 'vitest';
import type { InstallationInfo } from '@/shared/types';
import { withAchievementsComponent } from './installation-info';

vi.mock('electron', () => ({ app: { getPath: () => '/user-data' } }));

const base: InstallationInfo = {
  gameId: 'g',
  version: '1.0.0',
  installedAt: '2026-01-01T00:00:00.000Z',
  gamePath: '/games/g',
  installerPath: '/games/g/setup.exe',
  installedFiles: [],
  components: {
    text: { installed: true, files: [] },
    achievements: { installed: true, files: [], appIds: [1] },
  },
};

describe('withAchievementsComponent', () => {
  it('keeps the installer-based record and swaps only the achievements', () => {
    const next = withAchievementsComponent(base, {
      installed: true,
      files: [],
      appIds: [2],
    });
    expect(next.installerPath).toBe('/games/g/setup.exe');
    expect(next.components?.text).toEqual({ installed: true, files: [] });
    expect(next.components?.achievements?.appIds).toEqual([2]);
  });

  it('drops the achievements entry when none are kept', () => {
    expect(withAchievementsComponent(base, null).components).toEqual({
      text: { installed: true, files: [] },
    });
  });
});
