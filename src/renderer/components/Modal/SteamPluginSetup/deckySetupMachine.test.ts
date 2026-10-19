import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { type Actor, createActor, fromPromise } from 'xstate';
import type {
  DeckyInstallResult,
  DeckyLoaderInstallResult,
  PluginHostState,
} from '@/shared/plugin-host-types';
import { deckyState, pluginHostState } from '../../../utils/pluginHost.fixture';
import { deckySetupMachine } from './deckySetupMachine';

let actor: Actor<typeof deckySetupMachine> | null = null;

const savedZip = () =>
  Promise.resolve<{ success: boolean; path?: string }>({
    success: true,
    path: '/tmp/lbk.zip',
  });

function start(initialHost: PluginHostState | null = null) {
  const request = vi.fn(() =>
    Promise.resolve<DeckyInstallResult>({ success: true, state: 'prompted' })
  );
  const installLoader = vi.fn(() =>
    Promise.resolve<DeckyLoaderInstallResult>({ success: true })
  );
  const refreshHost = vi.fn(() => Promise.resolve<PluginHostState | null>(null));
  const machine = createActor(
    deckySetupMachine.provide({
      actors: {
        request: fromPromise(() => request()),
        installLoader: fromPromise(() => installLoader()),
        saveZip: fromPromise(() => savedZip()),
        refreshHost: fromPromise(() => refreshHost()),
      },
    }),
    { input: { host: initialHost } }
  ).start();
  actor = machine;
  return { actor: machine, request, installLoader, refreshHost };
}

const flow = (h: ReturnType<typeof start>) => h.actor.getSnapshot().value.flow;
const flush = () => vi.advanceTimersByTimeAsync(0);
const host = (
  decky: PluginHostState['decky'],
  deckyLoader: PluginHostState['deckyLoader'] = null
) => pluginHostState({ host: 'decky', decky, deckyLoader });

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  actor?.stop();
  actor = null;
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
    [new Error('ipc'), 'fallback'],
  ] as const)('routes %o to %s', async (result, target) => {
    const h = start();
    h.request.mockImplementation(() =>
      result instanceof Error ? Promise.reject(result) : Promise.resolve(result)
    );
    h.actor.send({ type: 'REQUEST' });
    await flush();
    expect(flow(h)).toBe(target);
    expect(h.refreshHost).toHaveBeenCalledTimes(target === 'intro' ? 1 : 0);
  });

  it('stays on the request screen until the host state after no-decky is in', async () => {
    const h = start();
    let resolveRefresh: (state: PluginHostState | null) => void = () => undefined;
    h.refreshHost.mockReturnValue(
      new Promise((resolve) => {
        resolveRefresh = resolve;
      })
    );
    h.request.mockResolvedValue({ success: false, reason: 'no-decky' });
    h.actor.send({ type: 'REQUEST' });
    await flush();
    expect(flow(h)).toBe('refreshingHost');
    h.actor.send({ type: 'REQUEST' });
    expect(h.request).toHaveBeenCalledTimes(1);

    resolveRefresh(null);
    await flush();
    expect(flow(h)).toBe('intro');
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

  it('opens on an installer that is already running in the stored host state', () => {
    const h = start(host(null, { installing: true, blockedBy: null, repair: false }));
    expect(flow(h)).toBe('loaderRunning');
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
