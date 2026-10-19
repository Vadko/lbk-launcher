import { assign, fromPromise, not, setup } from 'xstate';
import { t } from '@/shared/i18n/i18n';
import type {
  DeckyInstallResult,
  DeckyLoaderInstallResult,
  PluginHostState,
} from '@/shared/plugin-host-types';
import type { ElectronAPI } from '@/shared/types';
import { useSteamPluginHostStore } from '../../../store/useSteamPluginHostStore';

export type LoaderFailure = Extract<
  DeckyLoaderInstallResult,
  { success: false }
>['reason'];

type SaveZipResult = Awaited<ReturnType<ElectronAPI['saveDeckyPluginZip']>>;

interface DeckySetupContext {
  host: PluginHostState | null;
  loaderInstalled: boolean;
  loaderFailure: LoaderFailure;
  showSaveZip: boolean;
  savedMessage: string | null;
}

type DeckySetupEvent =
  | { type: 'HOST_STATE'; state: PluginHostState | null }
  | { type: 'INSTALL_LOADER' }
  | { type: 'REQUEST' }
  | { type: 'SAVE_ZIP' };

const savedMessage = (result: SaveZipResult): string =>
  result.success && result.path
    ? t('deckySetup.saved', { path: result.path })
    : result.error
      ? t('deckySetup.saveFailedWithError', { error: result.error })
      : t('deckySetup.saveFailed');

// The plugin dir appearing (pushed by main's Decky watcher) is the only success signal: Decky's install call returns before the user confirms.
export const deckySetupMachine = setup({
  types: {
    context: {} as DeckySetupContext,
    events: {} as DeckySetupEvent,
    input: {} as { host: PluginHostState | null },
  },
  actors: {
    installLoader: fromPromise<DeckyLoaderInstallResult>(async () => {
      const result = await window.electronAPI
        .installDeckyLoader()
        .catch((error: unknown): DeckyLoaderInstallResult => {
          console.warn('[DeckySetup] Decky Loader install failed:', error);
          return { success: false, reason: 'not-installed' };
        });
      await useSteamPluginHostStore.getState().refresh();
      return result;
    }),
    request: fromPromise<DeckyInstallResult>(() =>
      window.electronAPI.requestDeckyPluginInstall()
    ),
    saveZip: fromPromise<SaveZipResult>(() => window.electronAPI.saveDeckyPluginZip()),
    refreshHost: fromPromise<PluginHostState | null>(() =>
      useSteamPluginHostStore.getState().refresh()
    ),
  },
  guards: {
    // The modal may be reopened while an installer it started earlier is still running.
    loaderBusy: ({ context }) => context.host?.deckyLoader?.installing === true,
    pluginReady: ({ context }) => {
      const plugin = context.host?.decky?.plugin;
      return plugin?.installed === true && !plugin.outdated;
    },
  },
  delays: {
    saveZipReveal: 30_000,
    fallback: 5 * 60 * 1000,
  },
}).createMachine({
  id: 'deckySetup',
  type: 'parallel',
  // Seeded with the host state already in the store, so a reopened modal goes straight to a running installer.
  context: ({ input }) => ({
    host: input.host,
    loaderInstalled: false,
    loaderFailure: 'not-installed',
    showSaveZip: false,
    savedMessage: null,
  }),
  on: {
    HOST_STATE: { actions: assign({ host: ({ event }) => event.state }) },
  },
  states: {
    flow: {
      initial: 'intro',
      states: {
        intro: {
          always: { guard: 'loaderBusy', target: 'loaderRunning' },
          on: { INSTALL_LOADER: 'loaderInstalling', REQUEST: 'requesting' },
        },
        loaderRunning: { always: { guard: not('loaderBusy'), target: 'intro' } },
        loaderInstalling: {
          invoke: {
            src: 'installLoader',
            onDone: [
              {
                guard: ({ event }) => event.output.success,
                target: 'intro',
                actions: assign({ loaderInstalled: true }),
              },
              {
                target: 'loaderFailed',
                actions: assign({
                  loaderFailure: ({ event }) =>
                    event.output.success ? 'not-installed' : event.output.reason,
                }),
              },
            ],
            onError: {
              target: 'loaderFailed',
              actions: assign({ loaderFailure: 'not-installed' }),
            },
          },
        },
        loaderFailed: {
          on: { INSTALL_LOADER: 'loaderInstalling' },
        },
        requesting: {
          invoke: {
            src: 'request',
            onDone: [
              {
                guard: ({ event }) =>
                  event.output.success && event.output.state === 'installed',
                target: 'done',
              },
              { guard: ({ event }) => event.output.success, target: 'waiting' },
              {
                guard: ({ event }) =>
                  !event.output.success && event.output.reason === 'no-decky',
                target: 'refreshingHost',
              },
              { target: 'fallback' },
            ],
            onError: {
              target: 'fallback',
              actions: ({ event }) =>
                console.warn('[DeckySetup] Install request failed:', event.error),
            },
          },
        },
        // Waits for the fresh state, so the intro never renders the stale plugin offer first.
        refreshingHost: {
          invoke: { src: 'refreshHost', onDone: 'intro', onError: 'intro' },
        },
        waiting: {
          always: { guard: 'pluginReady', target: 'done' },
          after: {
            saveZipReveal: { actions: assign({ showSaveZip: true }) },
            fallback: 'fallback',
          },
        },
        fallback: {},
        done: {},
      },
    },
    zip: {
      initial: 'idle',
      states: {
        idle: { on: { SAVE_ZIP: 'saving' } },
        saving: {
          invoke: {
            src: 'saveZip',
            onDone: {
              target: 'idle',
              actions: assign({
                savedMessage: ({ event }) => savedMessage(event.output),
              }),
            },
            onError: {
              target: 'idle',
              actions: ({ event }) =>
                console.warn('[DeckySetup] Saving the zip failed:', event.error),
            },
          },
        },
      },
    },
  },
});
