import { afterEach, describe, expect, it, vi } from 'vitest';
import { type Actor, createActor, fromCallback, fromPromise } from 'xstate';
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
    [{ success: true }, 'done', 'Millennium видалено.'],
    [
      { success: true, queued: true },
      'done',
      'Millennium буде видалено, щойно ви закриєте Steam.',
    ],
    [{ success: false, reason: 'files-locked' }, 'done', 'Файли Steam ще зайняті.'],
    [
      { success: false, reason: 'restart-failed', restartReason: 'timeout' },
      'error',
      'не закрився вчасно',
    ],
    [
      { success: false, reason: 'script-failed', error: 'EPERM' },
      'error',
      'Не вдалося видалити Millennium: EPERM',
    ],
    [
      { success: false, reason: 'restart-failed', queued: true },
      'error',
      'щойно ви закриєте Steam',
    ],
    [null, 'error', 'Не вдалося видалити Millennium.'],
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
