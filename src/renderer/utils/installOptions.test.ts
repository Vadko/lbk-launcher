import { describe, expect, it } from 'vitest';
import type { AchievementsBadge } from '@/shared/plugin-host-types';
import {
  achievementsOptionState,
  calculateTotalSize,
  steamArtworkStartsChecked,
} from './installOptions';

const badge = (state: AchievementsBadge['state']): AchievementsBadge => ({
  state,
  unsupportedReason: null,
});

const option = (overrides: Partial<Parameters<typeof achievementsOptionState>[0]> = {}) =>
  achievementsOptionState({
    hasArchive: true,
    installed: false,
    checked: true,
    isReinstall: false,
    badge: badge('millennium'),
    ...overrides,
  });

describe('achievementsOptionState', () => {
  it.each([
    ['millennium', true],
    ['decky', true],
    ['after-restart', true],
    ['needs-millennium', false],
    ['needs-decky-plugin', false],
    ['needs-decky', false],
    ['unsupported', false],
    ['setting-off', false],
  ] as const)('%s → canToggle %s', (state, canToggle) => {
    expect(option({ badge: badge(state) }).canToggle).toBe(canToggle);
  });

  it('never sends false for installed strings behind a locked box', () => {
    const locked = option({
      badge: badge('needs-millennium'),
      installed: true,
      checked: false,
    });
    expect(locked.install).toBe(true);
    expect(locked.willRemove).toBe(false);
    expect(option({ badge: badge('needs-millennium'), checked: true }).install).toBe(
      false
    );
  });

  it('waits for the badge before unlocking', () => {
    const checking = option({ badge: null, installed: true });
    expect(checking).toMatchObject({ checking: true, canToggle: false, install: true });
  });

  it.each([
    ['installed strings stay', true, true],
    ['nothing installed asks for nothing', false, false],
  ])('locks the box without an archive: %s', (_case, installed, install) => {
    expect(option({ hasArchive: false, installed, checked: true })).toMatchObject({
      canToggle: false,
      install,
      willRemove: false,
      willDownload: false,
    });
  });

  it('plans download, reinstall and removal from the box', () => {
    expect(option()).toMatchObject({
      wants: true,
      willDownload: true,
      willReinstall: false,
    });
    expect(option({ installed: true, isReinstall: true })).toMatchObject({
      willDownload: false,
      willReinstall: true,
    });
    expect(option({ installed: true, checked: false })).toMatchObject({
      willRemove: true,
      wants: false,
    });
  });
});

describe('steamArtworkStartsChecked', () => {
  it.each<[string, boolean, boolean | undefined, boolean, boolean, boolean]>([
    ['a new install, from the setting', false, undefined, false, true, true],
    ['a new install with the setting off', false, undefined, false, false, false],
    ['a reinstall the player turned off', true, false, false, true, false],
    ['a reinstall the player turned on', true, true, false, false, true],
    [
      'a reinstall never offered artwork, from the setting',
      true,
      undefined,
      false,
      true,
      true,
    ],
    [
      'a reinstall with artwork from before the choice',
      true,
      undefined,
      true,
      false,
      true,
    ],
    [
      'a reinstall never offered artwork, setting off',
      true,
      undefined,
      false,
      false,
      false,
    ],
  ])('%s', (_case, isReinstall, chosen, applied, byDefault, expected) => {
    expect(steamArtworkStartsChecked({ isReinstall, chosen, applied, byDefault })).toBe(
      expected
    );
  });
});

describe('calculateTotalSize', () => {
  it('sums mixed units and passes a single size through', () => {
    expect(calculateTotalSize([])).toBe('N/A');
    expect(calculateTotalSize(['150 MB'])).toBe('150 MB');
    expect(calculateTotalSize(['1 GB', '512 MB'])).toBe('1.50 GB');
    expect(calculateTotalSize(['512 KB', 'junk'])).toBe('512.00 KB');
  });
});
