import { describe, expect, it } from 'vitest';
import type { AchievementsBadge, MillenniumUnsupportedReason } from '@/shared/types';
import {
  achievementsBadgeDetail,
  activationOutcome,
  millenniumPhaseText,
  millenniumUnsupportedText,
} from './steamPluginHost';

const REASONS: MillenniumUnsupportedReason[] = [
  'no-steam',
  'arch',
  'flatpak-steam',
  'snap-steam',
  'steam-rt64',
  'missing-libssl32',
  'steam-home-link',
  'nixos',
  'steamos',
  'decky-present',
  'macos-too-old',
  'no-release',
  'millennium-v2',
];

const badge = (
  state: AchievementsBadge['state'],
  unsupportedReason: MillenniumUnsupportedReason | null = null
): AchievementsBadge => ({ state, unsupportedReason });

describe('millenniumUnsupportedText', () => {
  it('has its own copy for every reason', () => {
    const fallback = millenniumUnsupportedText(null);
    for (const reason of REASONS) {
      expect(millenniumUnsupportedText(reason)).not.toBe(fallback);
    }
  });

  it('does not claim a macOS build outside macOS', () => {
    expect(millenniumUnsupportedText('no-release')).not.toContain('macOS');
  });
});

describe('achievementsBadgeDetail', () => {
  it('explains only the states that will not reach Steam', () => {
    expect(achievementsBadgeDetail(badge('setting-off'))).toContain(
      'Швидке застосування'
    );
    expect(achievementsBadgeDetail(badge('unsupported', 'flatpak-steam'))).toBe(
      millenniumUnsupportedText('flatpak-steam')
    );
    for (const state of [
      'millennium',
      'decky',
      'after-restart',
      'needs-millennium',
      'needs-decky-plugin',
      'needs-decky',
    ] as const) {
      expect(achievementsBadgeDetail(badge(state))).toBeNull();
    }
  });
});

describe('millenniumPhaseText', () => {
  it('says removal for the file step of an uninstall', () => {
    expect(millenniumPhaseText('install-files', 'install')).toBe('Встановлення файлів…');
    expect(millenniumPhaseText('install-files', 'uninstall')).toContain('Видалення');
    expect(millenniumPhaseText('stop-steam', 'uninstall')).toBe('Закриття Steam…');
  });
});

describe('activationOutcome', () => {
  it('trusts the activation result, not what prepare saw', () => {
    expect(activationOutcome({ success: true, queued: true })).toBe('queued');
    expect(
      activationOutcome({ success: true, bridge: 'unknown', steamRunning: false })
    ).toBe('done-offline');
    expect(
      activationOutcome({ success: true, bridge: 'ready', steamRunning: true })
    ).toBe('wait-plugin');
  });
});
