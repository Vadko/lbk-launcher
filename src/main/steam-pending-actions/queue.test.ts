import { describe, expect, it, vi } from 'vitest';
import {
  classifyPendingAction,
  isPendingSteamAction,
  orderPendingQueue,
  type PendingSteamAction,
  reducePendingQueue,
} from '@/main/steam-pending-actions/queue';

vi.mock('@/main/utils/store-storage', () => ({}));

const NOW = Date.parse('2026-10-09T12:00:00.000Z');
const DAY_MS = 24 * 60 * 60 * 1000;

function launchOptions(
  gameId: string,
  overrides: Partial<Extract<PendingSteamAction, { kind: 'launch-options' }>> = {}
): PendingSteamAction {
  return {
    kind: 'launch-options',
    gameId,
    gameName: `Game ${gameId}`,
    accountId: '12345',
    params: {
      appId: 620,
      windowsOptions: '-language ukrainian',
      linuxOptions: null,
      macosOptions: null,
    },
    queuedAt: new Date(NOW - 60_000).toISOString(),
    ...overrides,
  };
}

function plugin(
  enable: boolean,
  queuedAt = new Date(NOW).toISOString()
): PendingSteamAction {
  return { kind: 'millennium-plugin', enable, queuedAt };
}

function activate(
  overrides: Partial<Extract<PendingSteamAction, { kind: 'millennium-activate' }>> = {}
): PendingSteamAction {
  return {
    kind: 'millennium-activate',
    tag: 'v3.5.0',
    queuedAt: new Date(NOW - 60_000).toISOString(),
    attempts: 0,
    ...overrides,
  };
}

function deactivate(purge = false): PendingSteamAction {
  return {
    kind: 'millennium-deactivate',
    purge,
    queuedAt: new Date(NOW - 30_000).toISOString(),
    attempts: 0,
  };
}

const ctx = {
  now: NOW,
  accountId: '12345',
  installedGameIds: new Set(['a', 'b']),
  settingOn: true,
  millennium: {
    pinTag: 'v3.5.0',
    stagingReady: (tag: string) => tag === 'v3.5.0',
    recordPresent: true,
  },
};

describe('reducePendingQueue', () => {
  it('keeps one launch-options item per game, latest wins', () => {
    const first = launchOptions('a', { queuedAt: '2026-10-01T00:00:00.000Z' });
    const other = launchOptions('b');
    const latest = launchOptions('a', { queuedAt: '2026-10-09T00:00:00.000Z' });
    const q = reducePendingQueue(reducePendingQueue([first, other], latest), latest);
    expect(q).toEqual([other, latest]);
  });

  it('collapses plugin enable then disable to the last one', () => {
    const enable = plugin(true, '2026-10-08T00:00:00.000Z');
    const disable = plugin(false, '2026-10-09T00:00:00.000Z');
    const game = launchOptions('a');
    const q = reducePendingQueue(reducePendingQueue([enable], game), disable);
    expect(q).toEqual([game, disable]);
  });

  it('does not touch launch options when a plugin item is queued', () => {
    const game = launchOptions('a');
    expect(reducePendingQueue([game], plugin(true))).toHaveLength(2);
  });
});

describe('classifyPendingAction', () => {
  it('applies an item for the current account', () => {
    expect(classifyPendingAction(launchOptions('a'), ctx)).toBe('apply');
  });

  it('keeps an item queued for another Steam account', () => {
    expect(classifyPendingAction(launchOptions('a', { accountId: '999' }), ctx)).toBe(
      'keep'
    );
    expect(classifyPendingAction(launchOptions('a'), { ...ctx, accountId: null })).toBe(
      'keep'
    );
  });

  it('applies an item whose account was unknown when it was queued', () => {
    expect(classifyPendingAction(launchOptions('a', { accountId: null }), ctx)).toBe(
      'apply'
    );
  });

  it('drops an item for a game that is no longer installed', () => {
    expect(classifyPendingAction(launchOptions('gone'), ctx)).toBe('drop');
  });

  it('drops items older than 30 days, even for another account', () => {
    const old = new Date(NOW - 31 * DAY_MS).toISOString();
    expect(
      classifyPendingAction(launchOptions('a', { queuedAt: old, accountId: '999' }), ctx)
    ).toBe('drop');
    expect(classifyPendingAction(plugin(true, old), ctx)).toBe('drop');
    const fresh = new Date(NOW - 29 * DAY_MS).toISOString();
    expect(classifyPendingAction(launchOptions('a', { queuedAt: fresh }), ctx)).toBe(
      'apply'
    );
  });

  it('drops an item with an unparsable timestamp', () => {
    expect(classifyPendingAction(launchOptions('a', { queuedAt: 'soon' }), ctx)).toBe(
      'drop'
    );
  });

  it('drops a plugin item that contradicts the current setting', () => {
    expect(classifyPendingAction(plugin(true), ctx)).toBe('apply');
    expect(classifyPendingAction(plugin(false), ctx)).toBe('drop');
    expect(classifyPendingAction(plugin(false), { ...ctx, settingOn: false })).toBe(
      'apply'
    );
    expect(classifyPendingAction(plugin(true), { ...ctx, settingOn: false })).toBe(
      'drop'
    );
  });
});

describe('Millennium install items', () => {
  it('keeps a queued plugin toggle when an activation is added', () => {
    const toggle = plugin(true);
    const q = reducePendingQueue([toggle], activate());
    expect(q).toEqual([toggle, activate()]);
  });

  it('lets an uninstall replace a queued install and keeps launch options', () => {
    const game = launchOptions('a');
    const q = reducePendingQueue([game, activate()], deactivate(true));
    expect(q).toEqual([game, deactivate(true)]);
  });

  it('runs install items before everything else, in order', () => {
    const game = launchOptions('a');
    const toggle = plugin(true);
    expect(orderPendingQueue([game, toggle, activate()])).toEqual([
      activate(),
      game,
      toggle,
    ]);
  });

  it('drops a stale tag, missing staging and too many attempts', () => {
    expect(classifyPendingAction(activate(), ctx)).toBe('apply');
    expect(classifyPendingAction(activate({ tag: 'v3.4.0' }), ctx)).toBe('drop');
    expect(
      classifyPendingAction(activate(), {
        ...ctx,
        millennium: { ...ctx.millennium, stagingReady: () => false },
      })
    ).toBe('drop');
    expect(classifyPendingAction(activate({ attempts: 4 }), ctx)).toBe('apply');
    expect(classifyPendingAction(activate({ attempts: 5 }), ctx)).toBe('drop');
  });

  it('drops an uninstall once there is no LBK record', () => {
    expect(classifyPendingAction(deactivate(), ctx)).toBe('apply');
    expect(
      classifyPendingAction(deactivate(), {
        ...ctx,
        millennium: { ...ctx.millennium, recordPresent: false },
      })
    ).toBe('drop');
  });

  it('rejects install items that carry anything beyond the known fields', () => {
    expect(isPendingSteamAction(activate())).toBe(true);
    expect(isPendingSteamAction(deactivate())).toBe(true);
    expect(isPendingSteamAction({ ...activate(), stagedDir: 'C:\\evil' })).toBe(false);
    expect(isPendingSteamAction({ ...deactivate(), mode: 'windows' })).toBe(false);
    expect(isPendingSteamAction({ ...activate(), tag: '../x' })).toBe(false);
    expect(isPendingSteamAction({ ...activate(), attempts: -1 })).toBe(false);
  });

  it('keeps unknown keys on launch-options and toggle items but checks their params', () => {
    expect(isPendingSteamAction({ ...launchOptions('a'), source: 'newer-lbk' })).toBe(
      true
    );
    expect(isPendingSteamAction({ ...plugin(true), source: 'newer-lbk' })).toBe(true);
    const bad = launchOptions('a');
    expect(isPendingSteamAction({ ...bad, params: { appId: 0 } })).toBe(false);
    expect(isPendingSteamAction({ ...bad, accountId: undefined })).toBe(false);
  });
});
