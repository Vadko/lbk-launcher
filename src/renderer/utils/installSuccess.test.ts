import { describe, expect, it, vi } from 'vitest';
import {
  type InstallSuccessInput,
  installSuccessActions,
  installSuccessMessage,
  needsBridgeStatus,
} from './installSuccess';
import { steamBridgeStatus } from './pluginHostFixtures';

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
    [{ launchOptionsQueued: false, delivery: 'plugin-next-start' }, true],
    [{ launchOptionsQueued: false, delivery: 'needs-millennium' }, true],
    [{ launchOptionsQueued: false, delivery: 'unavailable' }, true],
    [{ launchOptionsQueued: false, delivery: 'needs-decky' }, false],
    [{ launchOptionsQueued: false, delivery: undefined }, false],
  ] as const)('%o → %s', (value, expected) => {
    expect(needsBridgeStatus(value)).toBe(expected);
  });
});

describe('installSuccessMessage', () => {
  it('appends launch options before achievements', () => {
    const message = installSuccessMessage(
      'Готово!',
      input({
        launchOptionsQueued: true,
        launchOptionsError: 'boom',
        delivery: 'plugin-next-start',
      })
    );
    expect(message.split('\n\n')).toEqual([
      'Готово!',
      expect.stringContaining('Параметри запуску застосуються автоматично'),
      'Не вдалося налаштувати параметри запуску Steam: boom',
      "Переклад досягнень з'явиться після наступного запуску Steam.",
    ]);
  });

  it('says whether LBK can install Millennium itself', () => {
    expect(installSuccessMessage('', input({ delivery: 'needs-millennium' }))).toContain(
      'лаунчер може встановити його сам'
    );
    const blocked = steamBridgeStatus({
      achievements: { state: 'needs-millennium', unsupportedReason: 'arch' },
    });
    expect(
      installSuccessMessage('', input({ delivery: 'needs-millennium', status: blocked }))
    ).not.toContain('лаунчер може встановити його сам');
  });

  it('adds nothing for live strings or skipped achievements', () => {
    expect(installSuccessMessage('Готово!', input({ delivery: 'plugin-live' }))).toBe(
      'Готово!'
    );
    expect(installSuccessMessage('Готово!', input())).toBe('Готово!');
  });
});

describe('installSuccessActions', () => {
  it('offers a restart only when it helps and Steam can be restarted', () => {
    expect(
      labels(input({ delivery: 'plugin-next-start', status: steamBridgeStatus() }))
    ).toEqual(['Зрозуміло', 'Перезапустити Steam зараз']);
    expect(
      labels(
        input({
          delivery: 'plugin-next-start',
          status: steamBridgeStatus({ canRestartSteam: false }),
        })
      )
    ).toEqual(['Зрозуміло']);
    expect(
      labels(input({ delivery: 'plugin-live', status: steamBridgeStatus() }))
    ).toEqual(['Зрозуміло']);
  });

  it('opens the offer target and keeps the modal open for sites', () => {
    const open = vi.fn();
    const declined = { millennium: true, decky: false };
    const [, site] = installSuccessActions(
      input({ delivery: 'needs-millennium', declined }),
      {
        restart: vi.fn(),
        open,
      }
    );
    expect(site).toMatchObject({ label: 'Що таке Millennium', keepOpen: true });
    site.onClick();
    expect(open).toHaveBeenCalledWith('millennium-site');

    const [, install] = installSuccessActions(input({ delivery: 'needs-decky' }), {
      restart: vi.fn(),
      open,
    });
    expect(install).toMatchObject({ label: 'Встановити Decky Loader', keepOpen: false });
  });
});
