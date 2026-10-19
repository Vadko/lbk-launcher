import { assign, fromCallback, fromPromise, setup } from 'xstate';
import { t } from '@/shared/i18n/i18n';
import type {
  MillenniumInstallResult,
  MillenniumProgress,
  PluginHostState,
  RestartSteamResult,
  SteamBridgeStatus,
} from '@/shared/plugin-host-types';
import {
  activationOutcome,
  millenniumFailureText,
  millenniumPhaseText,
} from '../../../utils/steamPluginHost';
import {
  failureStep,
  isPluginConnected,
  queuedParagraphs,
  type RestartChoice,
  restartBlockedNote,
  type SetupResult,
  setupDone,
  setupError,
} from './millenniumSetup';

const PLUGIN_WAIT_MS = 120_000;

export interface SetupWork {
  text: string;
  percent: number | null;
  cancellable: boolean;
}

interface MillenniumInstallContext {
  host: PluginHostState | null;
  steamWasRunning: boolean;
  restart: RestartChoice;
  work: SetupWork;
  restartChoice: { canRestart: boolean; note: string | null };
  startedAt: number;
  envMissing: boolean;
  steamGoneChecks: number;
  result: SetupResult;
}

type MillenniumInstallEvent =
  | { type: 'HOST_STATE'; state: PluginHostState | null }
  | { type: 'INSTALL' }
  | { type: 'ACTIVATE'; restart: RestartChoice }
  | { type: 'RESTART_STEAM' }
  | { type: 'RECHECK' }
  | { type: 'PROGRESS'; progress: MillenniumProgress };

function workFor(
  phase: MillenniumProgress['phase'],
  percent: number | null = null
): SetupWork {
  return {
    text: millenniumPhaseText(phase, 'install'),
    percent,
    cancellable: phase === 'download',
  };
}

const failureResult = ({
  context,
  event,
}: {
  context: MillenniumInstallContext;
  event: { output: MillenniumInstallResult };
}): SetupResult =>
  failureStep(event.output, context.host?.millennium.unsupportedReason ?? null);

const pastDeadline = (context: MillenniumInstallContext): boolean =>
  Date.now() >= context.startedAt + PLUGIN_WAIT_MS;

export const millenniumInstallMachine = setup({
  types: {
    context: {} as MillenniumInstallContext,
    events: {} as MillenniumInstallEvent,
  },
  actors: {
    progress: fromCallback(({ sendBack }) =>
      window.electronAPI.onMillenniumProgress((progress) =>
        sendBack({ type: 'PROGRESS', progress })
      )
    ),
    prepare: fromPromise<MillenniumInstallResult>(() =>
      window.electronAPI.prepareMillennium().catch((error: unknown) => {
        console.error('[MillenniumSetup] Prepare failed:', error);
        return { success: false, reason: 'download-failed' };
      })
    ),
    activate: fromPromise<MillenniumInstallResult, { restart: RestartChoice }>(
      ({ input }) =>
        window.electronAPI
          .activateMillennium({ restart: input.restart })
          .catch((error: unknown) => {
            console.error('[MillenniumSetup] Activation failed:', error);
            return { success: false, reason: 'script-failed' };
          })
    ),
    restartSteam: fromPromise<RestartSteamResult | null>(() =>
      window.electronAPI.restartSteam().catch(() => null)
    ),
    bridgeStatus: fromPromise<SteamBridgeStatus | null>(() =>
      window.electronAPI.getSteamBridgeStatus().catch(() => null)
    ),
    recheck: fromPromise<SteamBridgeStatus | null>(() =>
      window.electronAPI.recheckSteamBridge()
    ),
  },
  delays: { poll: 2000 },
}).createMachine({
  id: 'millenniumInstall',
  initial: 'intro',
  context: {
    host: null,
    steamWasRunning: true,
    restart: 'now',
    work: workFor('download', 0),
    restartChoice: { canRestart: false, note: null },
    startedAt: 0,
    envMissing: false,
    steamGoneChecks: 0,
    result: setupDone([]),
  },
  on: {
    HOST_STATE: { actions: assign({ host: ({ event }) => event.state }) },
  },
  states: {
    intro: {
      on: { INSTALL: 'working.preparing', RESTART_STEAM: 'working.restartingSteam' },
    },
    working: {
      invoke: { src: 'progress' },
      on: {
        PROGRESS: {
          actions: assign({
            work: ({ event }) =>
              workFor(
                event.progress.phase,
                event.progress.phase === 'download' ? (event.progress.percent ?? 0) : null
              ),
          }),
        },
      },
      initial: 'preparing',
      states: {
        preparing: {
          entry: assign({ work: workFor('download', 0) }),
          invoke: {
            src: 'prepare',
            onDone: [
              {
                guard: ({ event }) => !event.output.success || !event.output.ready,
                target: '#millenniumInstall.result',
                actions: assign({ result: failureResult }),
              },
              {
                guard: ({ event }) =>
                  event.output.steamRunning === true &&
                  event.output.canRestartSteam === true,
                target: '#millenniumInstall.confirmRestart',
                actions: assign({
                  steamWasRunning: true,
                  restartChoice: { canRestart: true, note: null },
                }),
              },
              {
                guard: ({ event }) => event.output.steamRunning === true,
                target: 'fetchingRestartNote',
                actions: assign({ steamWasRunning: true }),
              },
              {
                target: 'activating',
                actions: assign({ steamWasRunning: false, restart: 'now' }),
              },
            ],
          },
        },
        fetchingRestartNote: {
          invoke: {
            src: 'bridgeStatus',
            onDone: {
              target: '#millenniumInstall.confirmRestart',
              actions: assign({
                restartChoice: ({ event }) => ({
                  canRestart: false,
                  note: restartBlockedNote(event.output),
                }),
              }),
            },
          },
        },
        activating: {
          entry: assign(({ context }) => ({
            startedAt: Date.now(),
            work: workFor(
              context.steamWasRunning && context.restart === 'now'
                ? 'stop-steam'
                : 'install-files'
            ),
          })),
          invoke: {
            src: 'activate',
            input: ({ context }) => ({ restart: context.restart }),
            onDone: [
              {
                guard: ({ event }) => !event.output.success,
                target: '#millenniumInstall.result',
                actions: assign({ result: failureResult }),
              },
              {
                guard: ({ event }) => activationOutcome(event.output) === 'queued',
                target: '#millenniumInstall.result',
                actions: assign({ result: () => setupDone(queuedParagraphs()) }),
              },
              {
                guard: ({ event }) => activationOutcome(event.output) === 'done-offline',
                target: '#millenniumInstall.result',
                actions: assign({
                  result: setupDone([t('millenniumSetup.offlineDone')]),
                }),
              },
              {
                target: '#millenniumInstall.waitingPlugin',
                actions: assign({
                  envMissing: ({ event }) =>
                    event.output.diagnostics?.steamEnvMissing === true,
                }),
              },
            ],
          },
        },
        restartingSteam: {
          entry: assign({ startedAt: () => Date.now(), work: workFor('start-steam') }),
          invoke: {
            src: 'restartSteam',
            onDone: [
              {
                guard: ({ event }) => event.output?.success !== true,
                target: '#millenniumInstall.result',
                actions: assign({
                  result: ({ event }) =>
                    failureStep(
                      {
                        success: false,
                        reason: 'restart-failed',
                        restartReason: event.output?.reason,
                        error: event.output?.error,
                      },
                      null
                    ),
                }),
              },
              {
                target: '#millenniumInstall.waitingPlugin',
                actions: assign({ steamWasRunning: true, envMissing: false }),
              },
            ],
          },
        },
      },
    },
    confirmRestart: {
      on: {
        ACTIVATE: {
          target: 'working.activating',
          actions: assign({ restart: ({ event }) => event.restart }),
        },
      },
    },
    waitingPlugin: {
      entry: assign({ steamGoneChecks: 0 }),
      initial: 'polling',
      states: {
        polling: {
          invoke: {
            src: 'bridgeStatus',
            onDone: [
              {
                guard: ({ event }) => isPluginConnected(event.output),
                target: '#millenniumInstall.result',
                actions: assign({ result: setupDone([t('millenniumSetup.done')]) }),
              },
              {
                // Two misses in a row: one poll can land while Steam swaps its processes during start-up.
                guard: ({ context, event }) =>
                  event.output?.code === 'steam-not-running' &&
                  context.steamGoneChecks >= 1,
                target: '#millenniumInstall.result',
                actions: assign({
                  result: setupError(t('millenniumSetup.steamNotBack'), 'steam-not-back'),
                }),
              },
              {
                guard: ({ context }) => pastDeadline(context),
                target: '#millenniumInstall.result',
                actions: assign({
                  result: ({ context }) =>
                    context.envMissing
                      ? setupError(t('millenniumSetup.envMissing'), 'env-missing')
                      : setupError(
                          millenniumFailureText('plugin-not-connected'),
                          'recheck'
                        ),
                }),
              },
              {
                target: 'sleeping',
                actions: assign({
                  steamGoneChecks: ({ context, event }) =>
                    event.output?.code === 'steam-not-running'
                      ? context.steamGoneChecks + 1
                      : 0,
                }),
              },
            ],
          },
        },
        sleeping: { after: { poll: 'polling' } },
      },
    },
    result: {
      on: {
        INSTALL: 'working.preparing',
        RESTART_STEAM: 'working.restartingSteam',
        RECHECK: 'rechecking',
      },
    },
    rechecking: {
      invoke: {
        src: 'recheck',
        onDone: [
          {
            guard: ({ event }) => isPluginConnected(event.output),
            target: 'result',
            actions: assign({ result: setupDone([t('millenniumSetup.done')]) }),
          },
          { target: 'result' },
        ],
        onError: {
          target: 'result',
          actions: ({ event }) =>
            console.warn('[MillenniumSetup] Recheck failed:', event.error),
        },
      },
    },
  },
});
