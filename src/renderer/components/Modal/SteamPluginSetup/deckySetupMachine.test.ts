import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { type Actor, createActor, fromPromise } from 'xstate';
import type {
  DeckyInstallResult,
  DeckyLoaderInstallResult,
  PluginHostState,
} from '@/shared/plugin-host-types';
import { deckyState, pluginHostState } from '../../../utils/pluginHostFixtures';
import { deckySetupMachine } from './deckySetupMachine';

interface Harness {
  actor: Actor<typeof deckySetupMachine>;
  request: ReturnType<typeof vi.fn<() => Promise<DeckyInstallResult>>>;
  installLoader: ReturnType<typeof vi.fn<() => Promise<DeckyLoaderInstallResult>>>;
  refreshHost: ReturnType<typeof vi.fn>;
}

let harness: Harness | null = null;

const savedZip = () =>
  Promise.resolve<{ success: boolean; path?: string }>({
    success: true,
    path: '/tmp/lbk.zip',
  });

function start(): Harness {
  const request = vi.fn(() =>
    Promise.resolve<DeckyInstallResult>({ success: true, state: 'prompted' })
  );
  const installLoader = vi.fn(() =>
    Promise.resolve<DeckyLoaderInstallResult>({ success: true })
  );
  const refreshHost = vi.fn();
  const actor = createActor(
    deckySetupMachine.provide({
      actors: {
        request: fromPromise(() => request()),
        installLoader: fromPromise(() => installLoader()),
        saveZip: fromPromise(() => savedZip()),
      },
      actions: { refreshHost },
    })
  );
  actor.start();
  harness = { actor, request, installLoader, refreshHost };
  return harness;
}

const flow = (h: Harness) => h.actor.getSnapshot().value.flow;
const flush = () => vi.advanceTimersByTimeAsync(0);
const host = (
  decky: PluginHostState['decky'],
  deckyLoader: PluginHostState['deckyLoader'] = null
) => pluginHostState({ host: 'decky', decky, deckyLoader });

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  harness?.actor.stop();
  harness = null;
  vi.useRealTimers();
});

describe('deckySetupMachine', () => {
  it('waits for the pushed plugin state after Decky prompts', async () => {
    const h = start();
    h.actor.send({ type: 'HOST_STATE', state: host(deckyState({ installed: false })) });
    h.actor.send({ type: 'REQUEST' });
    await flush();
    expect(flow(h)).toBe('waiting');

    h.actor.send({ type: 'HOST_STATE', state: host(deckyState()) });
    expect(flow(h)).toBe('done');
  });

  it('reveals the ZIP after 30 s and falls back after 5 min', async () => {
    const h = start();
    h.actor.send({ type: 'REQUEST' });
    await flush();
    await vi.advanceTimersByTimeAsync(29_999);
    expect(h.actor.getSnapshot().context.showSaveZip).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(h.actor.getSnapshot().context.showSaveZip).toBe(true);
    await vi.advanceTimersByTimeAsync(270_000);
    expect(flow(h)).toBe('fallback');

    h.actor.send({ type: 'SAVE_ZIP' });
    await flush();
    expect(h.actor.getSnapshot().context.savedMessage).toBe(
      'Файл збережено: /tmp/lbk.zip'
    );
  });

  it.each([
    [{ success: true, state: 'installed' }, 'done'],
    [{ success: false, reason: 'no-decky' }, 'intro'],
    [{ success: false, reason: 'timeout' }, 'fallback'],
  ] as const)('routes %o to %s', async (result, target) => {
    const h = start();
    h.request.mockResolvedValue(result);
    h.actor.send({ type: 'REQUEST' });
    await flush();
    expect(flow(h)).toBe(target);
    expect(h.refreshHost).toHaveBeenCalledTimes(target === 'intro' ? 1 : 0);
  });

  it('falls back when the request throws', async () => {
    const h = start();
    h.request.mockRejectedValue(new Error('ipc'));
    h.actor.send({ type: 'REQUEST' });
    await flush();
    expect(flow(h)).toBe('fallback');
  });

  it('installs the loader once and returns to the plugin intro', async () => {
    const h = start();
    h.actor.send({ type: 'INSTALL_LOADER' });
    h.actor.send({ type: 'INSTALL_LOADER' });
    await flush();
    expect(h.installLoader).toHaveBeenCalledTimes(1);
    expect(flow(h)).toBe('intro');
    expect(h.actor.getSnapshot().context.loaderInstalled).toBe(true);
  });

  it('keeps the failure reason for the retry screen', async () => {
    const h = start();
    h.installLoader.mockResolvedValue({ success: false, reason: 'game-mode' });
    h.actor.send({ type: 'INSTALL_LOADER' });
    await flush();
    expect(flow(h)).toBe('loaderFailed');
    expect(h.actor.getSnapshot().context.loaderFailure).toBe('game-mode');
  });

  it('shows an installer started earlier until it exits', () => {
    const h = start();
    const loader = { installing: true, blockedBy: null, repair: false };
    h.actor.send({ type: 'HOST_STATE', state: host(null, loader) });
    expect(flow(h)).toBe('loaderRunning');
    h.actor.send({
      type: 'HOST_STATE',
      state: host(null, { ...loader, installing: false }),
    });
    expect(flow(h)).toBe('intro');
  });
});
