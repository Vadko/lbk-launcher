import { match, P } from 'ts-pattern';
import { assign, fromCallback, fromPromise, setup } from 'xstate';
import { t } from '@/shared/i18n/i18n';
import type {
  MillenniumInstallResult,
  MillenniumProgress,
  PluginHostState,
} from '@/shared/plugin-host-types';
import {
  millenniumPhaseText,
  steamRunningBeforeChange,
} from '../../../utils/steamPluginHost';
import { type RestartChoice, restartFailedText } from './millenniumSetup';

export interface UninstallResult {
  kind: 'done' | 'error';
  message: string;
}

export function outcomeStep(result: MillenniumInstallResult | null): UninstallResult {
  return match(result)
    .returnType<UninstallResult>()
    .with({ success: true }, ({ queued }) => ({
      kind: 'done',
      message: queued ? t('millenniumUninstall.queued') : t('millenniumUninstall.done'),
    }))
    .with({ reason: 'files-locked' }, () => ({
      kind: 'done',
      message: t('millenniumUninstall.filesLocked'),
    }))
    .with({ reason: 'restart-failed' }, (failure) => ({
      kind: 'error',
      message: restartFailedText(failure, t('millenniumUninstall.queued')),
    }))
    .with(P.nullish, () => ({
      kind: 'error',
      message: t('millenniumUninstall.failed'),
    }))
    .otherwise(({ error }) => ({
      kind: 'error',
      message: error
        ? t('millenniumUninstall.failedWithError', { error })
        : t('millenniumUninstall.failed'),
    }));
}

interface UninstallContext {
  purge: boolean;
  steamRunning: boolean | undefined;
  restart: RestartChoice;
  text: string;
  result: UninstallResult;
}

type UninstallEvent =
  | { type: 'TOGGLE_PURGE' }
  | { type: 'CONFIRM'; steamRunning: boolean | undefined }
  | { type: 'CHOOSE'; restart: RestartChoice }
  | { type: 'PROGRESS'; progress: MillenniumProgress };

export const millenniumUninstallMachine = setup({
  types: {
    context: {} as UninstallContext,
    events: {} as UninstallEvent,
  },
  actors: {
    progress: fromCallback(({ sendBack }) =>
      window.electronAPI.onMillenniumProgress((progress) =>
        sendBack({ type: 'PROGRESS', progress })
      )
    ),
    hostState: fromPromise<PluginHostState | null>(() =>
      window.electronAPI.getPluginHostState().catch(() => null)
    ),
    uninstall: fromPromise<
      MillenniumInstallResult | null,
      { purge: boolean; restart: RestartChoice }
    >(({ input }) =>
      window.electronAPI.uninstallMillennium(input).catch((error: unknown) => {
        console.error('[MillenniumSetup] Uninstall failed:', error);
        return null;
      })
    ),
  },
}).createMachine({
  id: 'millenniumUninstall',
  initial: 'confirm',
  context: {
    purge: false,
    steamRunning: undefined,
    restart: 'now',
    text: t('millenniumUninstall.progress'),
    result: outcomeStep(null),
  },
  states: {
    confirm: {
      on: {
        TOGGLE_PURGE: { actions: assign({ purge: ({ context }) => !context.purge }) },
        CONFIRM: {
          target: 'checkingSteam',
          actions: assign({ steamRunning: ({ event }) => event.steamRunning }),
        },
      },
    },
    checkingSteam: {
      on: {
        TOGGLE_PURGE: { actions: assign({ purge: ({ context }) => !context.purge }) },
      },
      invoke: {
        src: 'hostState',
        onDone: [
          {
            guard: ({ context, event }) =>
              steamRunningBeforeChange(event.output?.steamRunning, context.steamRunning),
            target: 'confirmRestart',
          },
          { target: 'uninstalling', actions: assign({ restart: 'now' }) },
        ],
      },
    },
    confirmRestart: {
      on: {
        CHOOSE: {
          target: 'uninstalling',
          actions: assign({ restart: ({ event }) => event.restart }),
        },
      },
    },
    uninstalling: {
      entry: assign({ text: t('millenniumUninstall.progress') }),
      invoke: [
        { src: 'progress' },
        {
          src: 'uninstall',
          input: ({ context }) => ({ purge: context.purge, restart: context.restart }),
          onDone: {
            target: 'result',
            actions: assign({ result: ({ event }) => outcomeStep(event.output) }),
          },
        },
      ],
      on: {
        PROGRESS: {
          actions: assign({
            text: ({ event }) => millenniumPhaseText(event.progress.phase, 'uninstall'),
          }),
        },
      },
    },
    result: {},
  },
});
