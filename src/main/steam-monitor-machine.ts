import { assign, fromPromise, raise, setup } from 'xstate';
import { isWindows } from '@/main/utils/platform';
import type { SteamBridgeStatusCode } from '@/shared/plugin-host-types';

export interface BridgeFacts {
  up: boolean;
  code: SteamBridgeStatusCode | null;
}

export interface StartupOutput {
  running: boolean;
  candidate: boolean;
}

export interface ProbeInput {
  bridge: BridgeFacts;
  candidate: boolean;
}

export interface ProbeOutput {
  // null when nothing needed a process scan.
  running: boolean | null;
  queued: boolean;
  // Set when polling was not needed when the probe began, which also drops the running baseline.
  candidate: boolean | null;
}

interface MonitorContext {
  pauses: number;
  lastRunning: boolean | null;
  bridge: BridgeFacts;
  candidate: boolean;
  wakePending: boolean;
}

type MonitorEvent =
  | { type: 'WAKE' }
  | { type: 'PAUSE' }
  | { type: 'RESUME' }
  | { type: 'ARM_RECHECK' }
  | { type: 'BRIDGE_READY' }
  | { type: 'BRIDGE_STATUS'; bridge: BridgeFacts }
  | { type: 'STEAM_EXITED' };

type ProbeVerdict = 'idle' | 'exited' | 'found-stopped' | 'started' | 'unchanged';

function probeVerdict(lastRunning: boolean | null, output: ProbeOutput): ProbeVerdict {
  if (output.running === null) {
    return 'idle';
  }
  const previous = output.candidate === null ? lastRunning : null;
  if (previous === null) {
    return !output.running && output.queued ? 'found-stopped' : 'unchanged';
  }
  if (previous && !output.running) {
    return 'exited';
  }
  return !previous && output.running ? 'started' : 'unchanged';
}

function probeUpdate(context: MonitorContext, output: ProbeOutput) {
  return {
    lastRunning: output.running,
    candidate: output.candidate ?? context.candidate,
  };
}

const notProvided = (name: string) => () =>
  Promise.reject(new Error(`[PendingActions] Steam monitor ${name} is not provided`));

const logFailure = (label: string) => (args: { event: { error: unknown } }) => {
  console.warn(`[PendingActions] ${label}:`, args.event.error);
};

// Polls for Steam's exit only while something waits for it; LBK's own restart pauses it.
export const steamMonitorMachine = setup({
  types: {
    context: {} as MonitorContext,
    events: {} as MonitorEvent,
  },
  actors: {
    startup: fromPromise<StartupOutput>(notProvided('startup')),
    probe: fromPromise<ProbeOutput, ProbeInput>(notProvided('probe')),
    handleStopped: fromPromise<'came-back' | 'ran'>(notProvided('handleStopped')),
    refreshBridge: fromPromise<BridgeFacts | null>(notProvided('refreshBridge')),
  },
  actions: {
    fireStarted: () => undefined,
    fireExited: () => undefined,
    applyLiveLaunchOptions: () => undefined,
  },
  guards: {
    needsPolling: () => false,
  },
  delays: {
    poll: isWindows() ? 15000 : 10000,
    // Idle wake-ups only read the store and stat a file; no process is spawned.
    idle: 60000,
    // Slightly longer than the bridge's post-launch verification window.
    recheck: 65000,
  },
}).createMachine({
  id: 'steamMonitor',
  type: 'parallel',
  context: {
    pauses: 0,
    lastRunning: null,
    bridge: { up: false, code: null },
    candidate: false,
    wakePending: false,
  },
  on: {
    PAUSE: { actions: assign({ pauses: ({ context }) => context.pauses + 1 }) },
    RESUME: [
      {
        guard: ({ context }) => context.pauses === 1,
        actions: [
          assign({ pauses: 0, lastRunning: null }),
          raise({ type: 'ARM_RECHECK' }),
          raise({ type: 'WAKE' }),
        ],
      },
      {
        guard: ({ context }) => context.pauses > 1,
        actions: assign({ pauses: ({ context }) => context.pauses - 1 }),
      },
    ],
    BRIDGE_READY: {
      actions: [
        assign({ bridge: ({ context }) => ({ ...context.bridge, up: true }) }),
        'applyLiveLaunchOptions',
      ],
    },
    BRIDGE_STATUS: { actions: assign({ bridge: ({ event }) => event.bridge }) },
    STEAM_EXITED: {
      actions: assign({ bridge: ({ context }) => ({ ...context.bridge, up: false }) }),
    },
  },
  states: {
    loop: {
      initial: 'booting',
      states: {
        booting: {
          invoke: {
            src: 'startup',
            onDone: {
              target: 'waiting',
              actions: assign(({ event }) => ({
                lastRunning: event.output.running,
                candidate: event.output.candidate,
              })),
            },
            onError: { target: 'waiting', actions: logFailure('Startup check failed') },
          },
          on: { WAKE: { actions: assign({ wakePending: true }) } },
        },
        waiting: {
          always: [
            { guard: ({ context }) => context.pauses > 0, target: 'paused' },
            { guard: ({ context }) => context.wakePending, target: 'probing' },
          ],
          after: {
            poll: { guard: 'needsPolling', target: 'probing' },
            idle: { target: 'probing' },
          },
          on: { WAKE: 'probing' },
        },
        probing: {
          entry: assign({ wakePending: false }),
          invoke: {
            src: 'probe',
            input: ({ context }) => ({
              bridge: context.bridge,
              candidate: context.candidate,
            }),
            onDone: [
              {
                guard: ({ context, event }) =>
                  probeVerdict(context.lastRunning, event.output) === 'exited',
                target: 'steamStopped',
                actions: [
                  () => console.log('[PendingActions] Steam exited'),
                  assign(({ context, event }) => probeUpdate(context, event.output)),
                ],
              },
              {
                guard: ({ context, event }) =>
                  probeVerdict(context.lastRunning, event.output) === 'found-stopped',
                target: 'steamStopped',
                actions: assign(({ context, event }) =>
                  probeUpdate(context, event.output)
                ),
              },
              {
                guard: ({ context, event }) =>
                  probeVerdict(context.lastRunning, event.output) === 'started',
                target: 'waiting',
                actions: [
                  () => console.log('[PendingActions] Steam started'),
                  assign(({ context, event }) => probeUpdate(context, event.output)),
                  'fireStarted',
                  raise({ type: 'ARM_RECHECK' }),
                ],
              },
              {
                target: 'waiting',
                actions: assign(({ context, event }) =>
                  probeUpdate(context, event.output)
                ),
              },
            ],
            onError: {
              target: 'waiting',
              actions: logFailure('Steam monitor tick failed'),
            },
          },
          on: { WAKE: { actions: assign({ wakePending: true }) } },
        },
        steamStopped: {
          entry: assign({ bridge: ({ context }) => ({ ...context.bridge, up: false }) }),
          invoke: {
            src: 'handleStopped',
            onDone: [
              {
                guard: ({ event }) => event.output === 'came-back',
                target: 'waiting',
                actions: [
                  () =>
                    console.log(
                      '[PendingActions] Steam came back before the queue could run'
                    ),
                  'fireExited',
                  assign({ lastRunning: true }),
                  'fireStarted',
                  raise({ type: 'ARM_RECHECK' }),
                ],
              },
              { target: 'waiting' },
            ],
            onError: {
              target: 'waiting',
              actions: logFailure('Steam monitor tick failed'),
            },
          },
          on: { WAKE: { actions: assign({ wakePending: true }) } },
        },
        paused: {
          entry: assign({ lastRunning: null }),
          on: {
            WAKE: { guard: ({ context }) => context.pauses === 0, target: 'probing' },
          },
        },
      },
    },
    recheck: {
      initial: 'idle',
      states: {
        idle: { on: { ARM_RECHECK: 'armed' } },
        armed: {
          after: { recheck: 'refreshing' },
          on: { ARM_RECHECK: { target: 'armed', reenter: true } },
        },
        refreshing: {
          invoke: {
            src: 'refreshBridge',
            onDone: { target: 'idle', actions: raise({ type: 'WAKE' }) },
            onError: 'idle',
          },
          on: { ARM_RECHECK: 'armed' },
        },
      },
    },
  },
});
