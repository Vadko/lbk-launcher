import { describe, expect, it, vi } from 'vitest';
import { t } from '@/shared/i18n/i18n';
import {
  type InstallSuccessInput,
  installSuccessActions,
  installSuccessMessage,
  needsBridgeStatus,
} from './installSuccess';
import { steamBridgeStatus } from './pluginHost.fixture';

const input = (overrides: Partial<InstallSuccessInput> = {}): InstallSuccessInput => ({
  launchOptionsQueued: false,
  delivery: undefined,
  status: null,
  declined: { millennium: false, decky: false },
  ...overrides,
});

const labels = (value: InstallSuccessInput) =>
  installSuccessActions(value, { restart: vi.fn(), open: vi.fn() }).map((a) => a.label);

describe('needsBridgeStatus', () => {
  it.each([
    [{ launchOptionsQueued: true, delivery: undefined }, true],
    [{ launchOptionsQueued: false, delivery: 'plugin-live' }, true],
    [{ launchOptionsQueued: false, delivery: 'needs-millennium' }, true],
    [{ launchOptionsQueued: false, delivery: 'unavailable' }, true],
    [{ launchOptionsQueued: false, delivery: 'needs-decky' }, false],
  ] as const)('%o → %s', (value, expected) => {
    expect(needsBridgeStatus(value)).toBe(expected);
  });
});

describe('installSuccessMessage', () => {
  it('appends launch options before achievements', () => {
    const message = installSuccessMessage(
      'Done!',
      input({
        launchOptionsQueued: true,
        launchOptionsError: 'boom',
        delivery: 'plugin-next-start',
      })
    );
    expect(message.split('\n\n')).toEqual([
      'Done!',
      t('installSuccess.launchOptionsQueued'),
      t('installSuccess.launchOptionsError', { error: 'boom' }),
      t('installSuccess.pluginNextStart'),
    ]);
  });

  it('adds the Epic Games Launcher notes as they are', () => {
    expect(
      installSuccessMessage(
        'Done!',
        input({
          eglLaunchOptionsNotes: ['First.', 'Second.'],
          launchOptionsError: 'boom',
        })
      ).split('\n\n')
    ).toEqual([
      'Done!',
      'First.',
      'Second.',
      t('installSuccess.launchOptionsError', { error: 'boom' }),
    ]);
  });

  it('says whether LBK can install Millennium itself', () => {
    expect(installSuccessMessage('', input({ delivery: 'needs-millennium' }))).toContain(
      t('installSuccess.needsMillenniumInstallable')
    );
    const blocked = steamBridgeStatus({
      achievements: { state: 'needs-millennium', unsupportedReason: 'arch' },
    });
    expect(
      installSuccessMessage('', input({ delivery: 'needs-millennium', status: blocked }))
    ).not.toContain(t('installSuccess.needsMillenniumInstallable'));
  });

  it('adds nothing for live strings or skipped achievements', () => {
    expect(installSuccessMessage('Done!', input({ delivery: 'plugin-live' }))).toBe(
      'Done!'
    );
    expect(installSuccessMessage('Done!', input())).toBe('Done!');
  });
});

describe('installSuccessActions', () => {
  it('offers a restart only when it helps and Steam can be restarted', () => {
    expect(
      labels(input({ delivery: 'plugin-next-start', status: steamBridgeStatus() }))
    ).toEqual([t('installSuccess.ok'), t('installSuccess.restartSteamNow')]);
    expect(
      labels(
        input({
          delivery: 'plugin-next-start',
          status: steamBridgeStatus({ canRestartSteam: false }),
        })
      )
    ).toEqual([t('installSuccess.ok')]);
    expect(
      labels(input({ delivery: 'plugin-live', status: steamBridgeStatus() }))
    ).toEqual([t('installSuccess.ok')]);
  });

  it('opens the offer target and keeps the modal open for sites', () => {
    const open = vi.fn();
    const declined = { millennium: true, decky: false };
    const [, site] = installSuccessActions(
      input({ delivery: 'needs-millennium', declined }),
      { restart: vi.fn(), open }
    );
    expect(site.keepOpen).toBe(true);
    site.onClick();
    expect(open).toHaveBeenCalledWith('millennium-site');

    const [, install] = installSuccessActions(input({ delivery: 'needs-millennium' }), {
      restart: vi.fn(),
      open,
    });
    expect(install.keepOpen).toBe(false);
  });
});

describe('an LBK Bridge update waiting for a Steam restart', () => {
  const outdated = (overrides: Parameters<typeof steamBridgeStatus>[0] = {}) =>
    steamBridgeStatus({ connected: true, updateAfterRestart: true, ...overrides });

  it.each([
    [
      'live strings and an outdated plugin',
      input({ delivery: 'plugin-live', status: outdated() }),
      true,
      [t('installSuccess.ok'), t('installSuccess.restartSteamNow')],
    ],
    [
      'an outdated plugin Steam cannot be restarted from here',
      input({ delivery: 'plugin-live', status: outdated({ canRestartSteam: false }) }),
      true,
      [t('installSuccess.ok')],
    ],
    [
      'live strings and a current plugin',
      input({ delivery: 'plugin-live', status: steamBridgeStatus({ connected: true }) }),
      false,
      [t('installSuccess.ok')],
    ],
    [
      'strings that already wait for the next Steam start',
      input({ delivery: 'plugin-next-start', status: outdated() }),
      false,
      [t('installSuccess.ok'), t('installSuccess.restartSteamNow')],
    ],
    [
      'skipped achievements',
      input({ status: outdated() }),
      false,
      [t('installSuccess.ok')],
    ],
  ])('%s', (_label, value, hint, actions) => {
    expect(
      installSuccessMessage('Done!', value).includes(t('pluginEntries.bridgeUpdate'))
    ).toBe(hint);
    expect(labels(value)).toEqual(actions);
  });
});
