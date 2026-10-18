import { describe, expect, it } from 'vitest';
import type { MillenniumInstallResult } from '@/shared/plugin-host-types';
import { pluginHostState, steamBridgeStatus } from '../../../utils/pluginHostFixtures';
import {
  failureStep,
  introMode,
  restartBlockedNote,
  STEAM_NOT_BACK_TEXT,
} from './millenniumSetup';

describe('failureStep', () => {
  it.each([
    ['not-writable', 'site'],
    ['conflict', 'none'],
    ['download-failed', 'retry'],
    [undefined, 'retry'],
  ] as const)('%s → %s', (reason, actions) => {
    expect(failureStep({ success: false, reason }, null)).toMatchObject({
      kind: 'error',
      actions,
    });
  });

  it('treats locked files as done: the change runs on the next Steam exit', () => {
    expect(failureStep({ success: false, reason: 'files-locked' }, null).kind).toBe(
      'done'
    );
  });

  it('separates a Steam that did not come back from other restart failures', () => {
    const restart = (extra: Partial<MillenniumInstallResult>) =>
      failureStep({ success: false, reason: 'restart-failed', ...extra }, null);
    expect(restart({ restartReason: 'launch-failed' })).toEqual({
      kind: 'error',
      message: STEAM_NOT_BACK_TEXT,
      actions: 'steam-not-back',
    });
    expect(restart({ restartReason: 'timeout', queued: true })).toMatchObject({
      actions: 'none',
      message: expect.stringContaining(
        'Millennium встановиться, щойно ви закриєте Steam.'
      ),
    });
  });

  it('names an external Millennium instead of the unsupported reason', () => {
    expect(
      failureStep({ success: false, reason: 'unsupported', error: 'external' }, 'arch')
    ).toMatchObject({ message: expect.stringContaining('уже встановлено') });
  });
});

describe('introMode', () => {
  const lbk = {
    managedBy: 'lbk' as const,
    version: '2.30.0',
    mode: null,
    needsRepair: false,
  };

  it.each([
    [null, 'loading'],
    [pluginHostState({ millennium: { pending: 'activate' } }), 'pending'],
    [
      pluginHostState({
        millennium: {
          installed: { ...lbk, needsRepair: true },
          update: { version: '3' },
        },
      }),
      'repair',
    ],
    [
      pluginHostState({ millennium: { installed: lbk, update: { version: '3' } } }),
      'update',
    ],
    [pluginHostState({ millennium: { installed: lbk } }), 'external'],
    [
      pluginHostState({ millennium: { installed: { ...lbk, managedBy: 'external' } } }),
      'external',
    ],
    [pluginHostState({ host: 'decky' }), 'unsupported'],
    [pluginHostState(), 'offer'],
  ] as const)('%#: %s', (state, mode) => {
    expect(introMode(state)).toBe(mode);
  });
});

describe('restartBlockedNote', () => {
  it('explains an elevated Steam or Game Mode, nothing else', () => {
    expect(restartBlockedNote(steamBridgeStatus({ steamElevated: true }))).toContain(
      'адміністратора'
    );
    expect(restartBlockedNote(steamBridgeStatus({ gamescope: true }))).toContain(
      'ігровому режимі'
    );
    expect(restartBlockedNote(steamBridgeStatus())).toBeNull();
    expect(restartBlockedNote(null)).toBeNull();
  });
});
