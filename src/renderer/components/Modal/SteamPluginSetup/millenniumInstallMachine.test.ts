import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { type Actor, createActor, fromCallback, fromPromise } from 'xstate';
import type {
  MillenniumInstallResult,
  RestartSteamResult,
  SteamBridgeStatus,
} from '@/shared/plugin-host-types';
import { pluginHostState, steamBridgeStatus } from '../../../utils/pluginHostFixtures';
import { millenniumUnsupportedText } from '../../../utils/steamPluginHost';
import { millenniumInstallMachine } from './millenniumInstallMachine';
import { DONE_TEXT, ENV_MISSING_TEXT, STEAM_NOT_BACK_TEXT } from './millenniumSetup';

let actor: Actor<typeof millenniumInstallMachine> | null = null;

function start() {
  const statuses: (SteamBridgeStatus | null)[] = [];
  const prepare = vi.fn(() =>
    Promise.resolve<MillenniumInstallResult>({
      success: true,
      ready: true,
      steamRunning: false,
    })
  );
  const activate = vi.fn((_restart: string) =>
    Promise.resolve<MillenniumInstallResult>({ success: true, steamRunning: true })
  );
  const restartSteam = vi.fn(() =>
    Promise.resolve<RestartSteamResult | null>({ success: true })
  );
  const recheck = vi.fn(() => Promise.resolve<SteamBridgeStatus | null>(null));
  const machine = createActor(
    millenniumInstallMachine.provide({
      actors: {
        progress: fromCallback(() => () => undefined),
        prepare: fromPromise(() => prepare()),
        activate: fromPromise(({ input }) => activate(input.restart)),
        restartSteam: fromPromise(() => restartSteam()),
        bridgeStatus: fromPromise(() =>
          Promise.resolve(
            statuses.length > 1 ? (statuses.shift() ?? null) : (statuses[0] ?? null)
          )
        ),
        recheck: fromPromise(() => recheck()),
      },
    })
  ).start();
  actor = machine;
  return { actor: machine, prepare, activate, restartSteam, statuses, recheck };
}

const flush = () => vi.advanceTimersByTimeAsync(0);
const state = (h: ReturnType<typeof start>) => h.actor.getSnapshot();

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  actor?.stop();
  actor = null;
  vi.useRealTimers();
});

describe('millenniumInstallMachine', () => {
  it('installs with Steam closed and waits for the plugin', async () => {
    const h = start();
    h.statuses.push(steamBridgeStatus({ code: 'ok', connected: true }));
    h.actor.send({ type: 'INSTALL' });
    expect(state(h).context.work).toMatchObject({ percent: 0, cancellable: true });
    await flush();
    expect(h.activate).toHaveBeenCalledWith('now');
    expect(state(h).matches('result')).toBe(true);
    expect(state(h).context.result).toEqual({ kind: 'done', paragraphs: [DONE_TEXT] });
  });

  it('asks before restarting a running Steam and honours the choice', async () => {
    const h = start();
    h.prepare.mockResolvedValue({
      success: true,
      ready: true,
      steamRunning: true,
      canRestartSteam: true,
    });
    h.activate.mockResolvedValue({ success: true, queued: true });
    h.actor.send({ type: 'INSTALL' });
    await flush();
    expect(state(h).matches('confirmRestart')).toBe(true);
    expect(state(h).context.restartChoice).toEqual({ canRestart: true, note: null });

    h.actor.send({ type: 'ACTIVATE', restart: 'on-exit' });
    expect(state(h).context.work.text).toBe('Встановлення файлів…');
    await flush();
    expect(h.activate).toHaveBeenCalledWith('on-exit');
    expect(state(h).context.result.kind).toBe('done');
  });

  it('explains why LBK cannot restart Steam', async () => {
    const h = start();
    h.prepare.mockResolvedValue({ success: true, ready: true, steamRunning: true });
    h.statuses.push(steamBridgeStatus({ code: 'ok', steamElevated: true }));
    h.actor.send({ type: 'INSTALL' });
    await flush();
    expect(state(h).context.restartChoice.canRestart).toBe(false);
    expect(state(h).context.restartChoice.note).toContain('від імені адміністратора');
  });

  it('gives up after Steam is gone on two polls in a row', async () => {
    const h = start();
    h.statuses.push(
      steamBridgeStatus({ code: 'steam-not-running' }),
      steamBridgeStatus({ code: 'ok' }),
      steamBridgeStatus({ code: 'steam-not-running' }),
      steamBridgeStatus({ code: 'steam-not-running' })
    );
    h.actor.send({ type: 'INSTALL' });
    await flush();
    await vi.advanceTimersByTimeAsync(2000);
    await vi.advanceTimersByTimeAsync(2000);
    expect(state(h).matches('waitingPlugin')).toBe(true);
    await vi.advanceTimersByTimeAsync(2000);
    expect(state(h).context.result).toEqual({
      kind: 'error',
      message: STEAM_NOT_BACK_TEXT,
      actions: 'steam-not-back',
    });
  });

  it('times out two minutes after activation started', async () => {
    const h = start();
    h.statuses.push(steamBridgeStatus({ code: 'ok' }));
    h.activate.mockImplementation(async () => {
      await new Promise((resolve) => setTimeout(resolve, 60_000));
      return {
        success: true,
        steamRunning: true,
        diagnostics: { steamEnvMissing: true },
      };
    });
    h.actor.send({ type: 'INSTALL' });
    await vi.advanceTimersByTimeAsync(60_000);
    expect(state(h).matches('waitingPlugin')).toBe(true);
    await vi.advanceTimersByTimeAsync(58_000);
    expect(state(h).matches('waitingPlugin')).toBe(true);
    await vi.advanceTimersByTimeAsync(2000);
    expect(state(h).context.result).toEqual({
      kind: 'error',
      message: ENV_MISSING_TEXT,
      actions: 'env-missing',
    });
  });

  it('routes failures to their actions and retries from the result', async () => {
    const h = start();
    h.actor.send({
      type: 'HOST_STATE',
      state: pluginHostState({
        millennium: { supported: false, unsupportedReason: 'arch' },
      }),
    });
    h.prepare.mockResolvedValueOnce({ success: false, reason: 'unsupported' });
    h.actor.send({ type: 'INSTALL' });
    await flush();
    expect(state(h).context.result).toEqual({
      kind: 'error',
      message: millenniumUnsupportedText('arch'),
      actions: 'none',
    });

    h.prepare.mockResolvedValueOnce({ success: false, reason: 'cancelled' });
    h.actor.send({ type: 'INSTALL' });
    await flush();
    expect(state(h).context.result).toMatchObject({ kind: 'error', actions: 'retry' });
  });

  it('waits for the plugin after LBK restarts Steam', async () => {
    const h = start();
    h.restartSteam.mockResolvedValueOnce({ success: false, reason: 'launch-failed' });
    h.actor.send({ type: 'RESTART_STEAM' });
    await flush();
    expect(state(h).context.result).toMatchObject({ actions: 'steam-not-back' });

    h.statuses.push(steamBridgeStatus({ code: 'ok', connected: true }));
    h.actor.send({ type: 'RESTART_STEAM' });
    await flush();
    expect(state(h).context.result).toEqual({ kind: 'done', paragraphs: [DONE_TEXT] });
  });

  it('finishes on a recheck that finds the plugin', async () => {
    const h = start();
    h.prepare.mockResolvedValue({ success: false, reason: 'download-failed' });
    h.actor.send({ type: 'INSTALL' });
    await flush();

    h.recheck.mockRejectedValueOnce(new Error('ipc'));
    h.actor.send({ type: 'RECHECK' });
    await flush();
    expect(state(h).context.result.kind).toBe('error');

    h.recheck.mockResolvedValueOnce(steamBridgeStatus({ code: 'ok', connected: true }));
    h.actor.send({ type: 'RECHECK' });
    await flush();
    expect(state(h).context.result).toEqual({ kind: 'done', paragraphs: [DONE_TEXT] });
  });
});
