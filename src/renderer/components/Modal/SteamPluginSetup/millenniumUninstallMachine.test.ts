import { afterEach, describe, expect, it, vi } from 'vitest';
import { type Actor, createActor, fromCallback, fromPromise } from 'xstate';
import { t } from '@/shared/i18n/i18n';
import type {
  MillenniumInstallResult,
  PluginHostState,
} from '@/shared/plugin-host-types';
import { pluginHostState } from '../../../utils/pluginHost.fixture';
import { millenniumUninstallMachine, outcomeStep } from './millenniumUninstallMachine';

let actor: Actor<typeof millenniumUninstallMachine> | null = null;

function start(fresh: PluginHostState | null) {
  const uninstall = vi.fn((_input: { purge: boolean; restart: string }) =>
    Promise.resolve<MillenniumInstallResult | null>({ success: true })
  );
  actor = createActor(
    millenniumUninstallMachine.provide({
      actors: {
        progress: fromCallback(() => () => undefined),
        hostState: fromPromise(() => Promise.resolve(fresh)),
        uninstall: fromPromise(({ input }) => uninstall(input)),
      },
    })
  ).start();
  return { actor, uninstall };
}

afterEach(() => {
  actor?.stop();
  actor = null;
});

describe('outcomeStep', () => {
  it.each([
    [{ success: true }, 'done', t('millenniumUninstall.done')],
    [{ success: true, queued: true }, 'done', t('millenniumUninstall.queued')],
    [
      { success: false, reason: 'files-locked' },
      'done',
      t('millenniumUninstall.filesLocked'),
    ],
    [
      { success: false, reason: 'restart-failed', restartReason: 'timeout' },
      'error',
      t('steamRestartFailure.timeout.plain'),
    ],
    [
      { success: false, reason: 'script-failed', error: 'EPERM' },
      'error',
      t('millenniumUninstall.failedWithError', { error: 'EPERM' }),
    ],
    [
      { success: false, reason: 'restart-failed', queued: true },
      'error',
      t('millenniumUninstall.queued'),
    ],
    [null, 'error', t('millenniumUninstall.failed')],
  ] as const)('%o → %s', (result, kind, text) => {
    const outcome = outcomeStep(result);
    expect(outcome.kind).toBe(kind);
    expect(outcome.message).toContain(text);
  });
});

describe('millenniumUninstallMachine', () => {
  it('removes at once when a fresh check finds Steam closed', async () => {
    const h = start(pluginHostState({ steamRunning: false }));
    h.actor.send({ type: 'TOGGLE_PURGE' });
    h.actor.send({ type: 'CONFIRM', steamRunning: true });
    await vi.waitFor(() => expect(h.actor.getSnapshot().matches('result')).toBe(true));
    expect(h.uninstall).toHaveBeenCalledWith({ purge: true, restart: 'now' });
  });

  it('asks before touching a running Steam, also when the fresh check fails', async () => {
    const h = start(null);
    h.actor.send({ type: 'CONFIRM', steamRunning: undefined });
    await vi.waitFor(() =>
      expect(h.actor.getSnapshot().matches('confirmRestart')).toBe(true)
    );
    h.actor.send({ type: 'CHOOSE', restart: 'on-exit' });
    await vi.waitFor(() => expect(h.actor.getSnapshot().matches('result')).toBe(true));
    expect(h.uninstall).toHaveBeenCalledWith({ purge: false, restart: 'on-exit' });
  });
});
