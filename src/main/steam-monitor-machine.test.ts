import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { type Actor, createActor, fromPromise } from 'xstate';
import {
  type BridgeFacts,
  type ProbeInput,
  type ProbeOutput,
  type StartupOutput,
  steamMonitorMachine,
} from './steam-monitor-machine';

const DELAYS = { poll: 1000, idle: 5000, recheck: 3000 };

interface Harness {
  actor: Actor<typeof steamMonitorMachine>;
  steam: { running: boolean };
  // Probes that a test holds open; empty means probes answer at once.
  held: ((output: ProbeOutput) => void)[];
  hold: { next: boolean };
  probe: ReturnType<typeof vi.fn>;
  handleStopped: ReturnType<typeof vi.fn<() => Promise<'came-back' | 'ran'>>>;
  refreshBridge: ReturnType<typeof vi.fn<() => Promise<null>>>;
  fireStarted: ReturnType<typeof vi.fn>;
  fireExited: ReturnType<typeof vi.fn>;
}

let harness: Harness | null = null;

function start(opts: { running: boolean; polling?: boolean }): Harness {
  const steam = { running: opts.running };
  const held: Harness['held'] = [];
  const hold = { next: false };
  const probe = vi.fn();
  const handleStopped = vi.fn(() => Promise.resolve<'came-back' | 'ran'>('ran'));
  const refreshBridge = vi.fn(() => Promise.resolve(null));
  const fireStarted = vi.fn();
  const fireExited = vi.fn();
  const actor = createActor(
    steamMonitorMachine.provide({
      actors: {
        startup: fromPromise<StartupOutput>(() =>
          Promise.resolve({ running: steam.running, candidate: false })
        ),
        probe: fromPromise<ProbeOutput, ProbeInput>(() => {
          probe();
          if (hold.next) {
            hold.next = false;
            return new Promise((resolve) => held.push(resolve));
          }
          return Promise.resolve({
            running: steam.running,
            queued: false,
            candidate: null,
          });
        }),
        handleStopped: fromPromise(() => handleStopped()),
        refreshBridge: fromPromise<BridgeFacts | null>(() => refreshBridge()),
      },
      actions: { fireStarted, fireExited },
      guards: { needsPolling: () => opts.polling ?? true },
      delays: DELAYS,
    })
  );
  actor.start();
  harness = {
    actor,
    steam,
    held,
    hold,
    probe,
    handleStopped,
    refreshBridge,
    fireStarted,
    fireExited,
  };
  return harness;
}

const loop = (h: Harness) => h.actor.getSnapshot().value.loop;
const recheck = (h: Harness) => h.actor.getSnapshot().value.recheck;
const flush = () => vi.advanceTimersByTimeAsync(0);

beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(console, 'log').mockImplementation(() => undefined);
});

afterEach(() => {
  harness?.actor.stop();
  harness = null;
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('steamMonitorMachine', () => {
  it('handles an exit that a probe saw, then goes back to waiting', async () => {
    const h = start({ running: true });
    await flush();
    h.hold.next = true;
    await vi.advanceTimersByTimeAsync(DELAYS.poll);
    expect(loop(h)).toBe('probing');

    h.held[0]({ running: false, queued: false, candidate: null });
    await flush();

    expect(h.handleStopped).toHaveBeenCalledTimes(1);
    expect(loop(h)).toBe('waiting');
    expect(h.actor.getSnapshot().context.bridge.up).toBe(false);
  });

  it('lets a probe finish across PAUSE, parks, and probes again on RESUME', async () => {
    const h = start({ running: true });
    await flush();
    h.hold.next = true;
    await vi.advanceTimersByTimeAsync(DELAYS.poll);
    h.actor.send({ type: 'PAUSE' });
    h.held[0]({ running: true, queued: false, candidate: null });
    await flush();

    expect(loop(h)).toBe('paused');
    expect(h.actor.getSnapshot().context.lastRunning).toBeNull();
    await vi.advanceTimersByTimeAsync(DELAYS.idle * 2);
    expect(h.probe).toHaveBeenCalledTimes(1);

    h.actor.send({ type: 'RESUME' });
    await flush();
    expect(h.probe).toHaveBeenCalledTimes(2);
    expect(recheck(h)).toBe('armed');
  });

  it('keeps a WAKE that arrives during a probe', async () => {
    const h = start({ running: true });
    await flush();
    h.hold.next = true;
    await vi.advanceTimersByTimeAsync(DELAYS.poll);
    h.actor.send({ type: 'WAKE' });
    h.held[0]({ running: true, queued: false, candidate: null });
    await flush();

    expect(h.probe).toHaveBeenCalledTimes(2);
  });

  it('re-arms the post-start recheck on every Steam start', async () => {
    const h = start({ running: false });
    await flush();
    h.steam.running = true;
    await vi.advanceTimersByTimeAsync(DELAYS.poll);
    expect(h.fireStarted).toHaveBeenCalledTimes(1);

    h.steam.running = false;
    await vi.advanceTimersByTimeAsync(DELAYS.poll);
    h.steam.running = true;
    await vi.advanceTimersByTimeAsync(DELAYS.poll);
    expect(h.fireStarted).toHaveBeenCalledTimes(2);

    await vi.advanceTimersByTimeAsync(DELAYS.recheck - 100);
    expect(h.refreshBridge).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(200);
    expect(h.refreshBridge).toHaveBeenCalledTimes(1);
  });

  it('reports a Steam that came back during the exit settle as exited and started', async () => {
    const h = start({ running: true });
    await flush();
    h.handleStopped.mockResolvedValueOnce('came-back');
    h.steam.running = false;
    await vi.advanceTimersByTimeAsync(DELAYS.poll);

    expect(h.fireExited).toHaveBeenCalledTimes(1);
    expect(h.fireStarted).toHaveBeenCalledTimes(1);
    expect(h.actor.getSnapshot().context.lastRunning).toBe(true);
    expect(recheck(h)).toBe('armed');
  });

  it('probes only at the idle interval while nothing waits for Steam', async () => {
    const h = start({ running: true, polling: false });
    await flush();
    await vi.advanceTimersByTimeAsync(DELAYS.poll);
    expect(h.probe).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(DELAYS.idle);
    expect(h.probe).toHaveBeenCalledTimes(1);
  });
});
