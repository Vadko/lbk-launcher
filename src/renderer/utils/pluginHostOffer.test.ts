import { describe, expect, it } from 'vitest';
import type { AchievementsBadge, AchievementsDelivery } from '@/shared/plugin-host-types';
import { pluginHostEntries } from './pluginHostEntries';
import { deckyState, pluginHostState } from './pluginHostFixtures';
import {
  deckyOffer,
  deliveryNote,
  millenniumOffer,
  OFFER_ACTIONS,
  successOffer,
} from './pluginHostOffer';

const badge = (
  state: AchievementsBadge['state'],
  unsupportedReason: AchievementsBadge['unsupportedReason'] = null
): AchievementsBadge => ({ state, unsupportedReason });

const managed = (
  overrides: Partial<{ version: string | null; needsRepair: boolean }> = {}
) => ({
  managedBy: 'lbk' as const,
  version: '2.30.0',
  mode: 'windows' as const,
  needsRepair: false,
  ...overrides,
});

describe('millenniumOffer', () => {
  it.each([
    [{ millennium: { installed: managed(), update: { version: '2.31.0' } } }, 'managed'],
    [
      { millennium: { installed: { ...managed(), managedBy: 'external' as const } } },
      'external',
    ],
    [{}, 'installable'],
    [
      { millennium: { supported: false, unsupportedReason: 'arch' as const } },
      'unavailable',
    ],
    [{ host: 'decky' as const }, 'unavailable'],
  ])('classifies %o as %s', (overrides, kind) => {
    expect(millenniumOffer(pluginHostState(overrides)).kind).toBe(kind);
  });
});

describe('deckyOffer', () => {
  it.each([
    [null, 'no-decky'],
    [deckyState({}, false), 'no-decky'],
    [deckyState({ disabled: true }), 'plugin-disabled'],
    [deckyState({ installed: false, disabled: true }), 'plugin-missing'],
    [deckyState({ outdated: true }), 'plugin-outdated'],
    [deckyState(), 'plugin-ready'],
  ])('classifies %o as %s', (decky, kind) => {
    expect(deckyOffer(pluginHostState({ host: 'decky', decky })).kind).toBe(kind);
  });

  it('offers the loader only where LBK can run its installer', () => {
    const loader = { installing: false, blockedBy: null, repair: false };
    expect(deckyOffer(pluginHostState({ host: 'decky', deckyLoader: loader }))).toEqual({
      kind: 'no-decky',
      canInstallLoader: true,
    });
  });
});

describe('deliveryNote', () => {
  it.each(['millennium', 'decky', 'after-restart'] as const)(
    'stays silent for %s, where the strings will reach Steam',
    (state) => {
      expect(deliveryNote(badge(state))).toBeNull();
    }
  );

  it('offers the Millennium install only where LBK can install it', () => {
    expect(deliveryNote(badge('needs-millennium'))?.actions).toEqual([
      OFFER_ACTIONS.installMillennium,
      OFFER_ACTIONS.millenniumInfo,
    ]);
    expect(deliveryNote(badge('needs-millennium', 'no-release'))?.actions).toEqual([
      OFFER_ACTIONS.millenniumInfo,
    ]);
  });

  it('links the Millennium site only for an outdated Millennium', () => {
    expect(deliveryNote(badge('unsupported', 'millennium-v2'))?.actions).toEqual([
      OFFER_ACTIONS.millenniumSite,
    ]);
    expect(deliveryNote(badge('unsupported', 'arch'))?.actions).toEqual([]);
  });
});

describe('successOffer', () => {
  const offer = (
    delivery: AchievementsDelivery,
    declined = { millennium: false, decky: false },
    millenniumInstallable = true
  ) => successOffer(delivery, { millenniumInstallable, declined })?.key ?? null;

  it.each([
    ['plugin-live', null],
    ['plugin-next-start', null],
    ['needs-millennium', 'install'],
    ['needs-decky-plugin', 'decky-install'],
    ['needs-decky', 'decky-loader-install'],
    ['unavailable', null],
    ['disabled', 'settings'],
  ] as const)('offers %s → %s', (delivery, key) => {
    expect(offer(delivery)).toBe(key);
  });

  it('falls back to the info links once an offer was declined', () => {
    const declined = { millennium: true, decky: true };
    expect(offer('needs-millennium', declined)).toBe('site');
    expect(offer('needs-decky-plugin', declined)).toBeNull();
    expect(offer('needs-decky', declined)).toBe('decky-site');
    expect(offer('needs-millennium', undefined, false)).toBe('site');
  });
});

describe('pluginHostEntries', () => {
  const keys = (...args: Parameters<typeof pluginHostState>) => {
    const { lines, actions } = pluginHostEntries(pluginHostState(...args));
    return { lines: lines.map((l) => l.key), actions: actions.map((a) => a.key) };
  };

  it('lists the Decky rows by plugin state', () => {
    const loader = { installing: false, blockedBy: null, repair: false };
    expect(keys({ host: 'decky', deckyLoader: loader })).toEqual({
      lines: ['no-decky'],
      actions: ['decky-loader-install', 'decky-site'],
    });
    expect(keys({ host: 'decky' }).actions).toEqual(['decky-site']);
    expect(keys({ host: 'decky', decky: deckyState({ disabled: true }) })).toEqual({
      lines: ['disabled'],
      actions: [],
    });
    expect(
      keys({ host: 'decky', decky: deckyState({ outdated: true }) }).actions
    ).toEqual(['decky-update']);
    expect(keys({ host: 'decky', decky: deckyState() })).toEqual({
      lines: [],
      actions: [],
    });
  });

  it('offers repair before update and uninstall unless removal is queued', () => {
    expect(
      keys({
        millennium: {
          installed: managed({ needsRepair: true }),
          update: { version: '3' },
        },
      })
    ).toEqual({ lines: ['repair'], actions: ['repair', 'uninstall'] });
    expect(
      keys({ millennium: { installed: managed(), update: { version: '3' } } })
    ).toEqual({
      lines: ['installed-version', 'update'],
      actions: ['update', 'uninstall'],
    });
    expect(
      keys({ millennium: { installed: managed(), pending: 'deactivate' } }).actions
    ).toEqual([]);
  });

  it('shows only the queued change while an activation waits', () => {
    expect(keys({ millennium: { pending: 'activate' } })).toEqual({
      lines: ['pending-activate'],
      actions: [],
    });
  });

  it('recommends Millennium unless the system cannot run it', () => {
    expect(keys()).toEqual({ lines: ['recommend'], actions: ['install', 'site'] });
    expect(
      keys({ millennium: { supported: false, unsupportedReason: 'no-release' } })
    ).toEqual({
      lines: ['recommend'],
      actions: ['site'],
    });
    expect(keys({ millennium: { supported: false, unsupportedReason: 'arch' } })).toEqual(
      {
        lines: ['unsupported'],
        actions: [],
      }
    );
  });
});
