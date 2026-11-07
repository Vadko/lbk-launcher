import { describe, expect, it } from 'vitest';
import { t } from '@/shared/i18n/i18n';
import { mayReplaceModal, restartFailureMessage } from './steamBridge';

describe('mayReplaceModal', () => {
  const progress = { title: 'Restarting Steam', message: '…' };

  it('replaces its own progress modal or an empty slot', () => {
    expect(mayReplaceModal(progress, progress)).toBe(true);
    expect(mayReplaceModal(null, progress)).toBe(true);
  });

  it('never replaces a modal another flow opened meanwhile', () => {
    expect(
      mayReplaceModal({ title: 'Running the installer', message: '…' }, progress)
    ).toBe(false);
  });
});

describe('restartFailureMessage', () => {
  it.each([
    ['access-denied', true, t('steamRestartFailure.access-denied.launchOptions')],
    ['access-denied', false, t('steamRestartFailure.access-denied.plain')],
    ['gamescope', true, t('steamRestartFailure.gamescope.launchOptions')],
    ['game-running', false, t('steamRestartFailure.game-running.plain')],
    ['timeout', true, t('steamRestartFailure.timeout.launchOptions')],
    ['launch-failed', true, t('steamRestartFailure.launch-failed')],
    ['launch-failed', false, t('steamRestartFailure.launch-failed')],
  ] as const)('%s with launch options %s', (reason, launchOptions, expected) => {
    expect(restartFailureMessage(reason, 'boom', launchOptions)).toBe(expected);
  });

  it.each([
    ['the error main sent', 'boom', 'boom'],
    ['the generic text without one', undefined, t('steamRestartFailure.generic')],
  ])('falls back to %s when no reason is known', (_label, error, expected) => {
    expect(restartFailureMessage(undefined, error, false)).toBe(expected);
  });
});
