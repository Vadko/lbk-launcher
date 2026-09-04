import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { openWorkshopPage } from '../utils/workshopPage';
import { electronStorage } from './electronStorage';

const POLL_INTERVAL_MS = 3000;
const POLL_LIMIT_MS = 10 * 60 * 1000;
/** Стільки null-відповідей поспіль означає, що місток зник і чекати далі нема чого */
const UNKNOWN_STREAK_LIMIT = 3;

const timers = new Map<string, ReturnType<typeof setTimeout>>();

type WorkshopPending = 'installing' | 'downloading' | 'removing';

interface WorkshopTargetParams {
  gameId: string;
  appId: number | null;
  workshopId: string;
}

interface WorkshopInstallsStore {
  installedAt: Record<string, string>;
  pending: Record<string, WorkshopPending>;
  setInstalled: (gameId: string, installed: boolean) => void;
  install: (params: WorkshopTargetParams) => Promise<void>;
  remove: (params: WorkshopTargetParams) => Promise<void>;
  reconcile: (gameId: string, appId: number, workshopId: string) => Promise<void>;
  reconcileAll: () => Promise<void>;
}

export const useWorkshopInstallsStore = create<WorkshopInstallsStore>()(
  persist(
    (set, get) => ({
      installedAt: {},
      pending: {},

      setInstalled: (gameId, installed) => {
        const current = get();
        if (
          installed === Boolean(current.installedAt[gameId]) &&
          !(gameId in current.pending)
        ) {
          return;
        }
        set((state) => {
          const pending = { ...state.pending };
          delete pending[gameId];
          if (installed === Boolean(state.installedAt[gameId])) {
            return { pending };
          }
          const installedAt = { ...state.installedAt };
          if (installed) {
            installedAt[gameId] = new Date().toISOString();
          } else {
            delete installedAt[gameId];
          }
          return { installedAt, pending };
        });
      },

      install: async ({ gameId, appId, workshopId }) => {
        try {
          if (appId) {
            setPending(set, gameId, 'installing');
            const result = await window.electronAPI.setWorkshopSubscription(
              gameId,
              appId,
              workshopId,
              true
            );
            if (result.ok) {
              trackOpen(gameId);
              watchDisk(set, get, { gameId, appId, workshopId, wanted: true });
              return;
            }
          }
          await openWorkshopPage(workshopId);
          trackOpen(gameId);
        } catch (error) {
          console.error('[Workshop] install failed', error);
        } finally {
          clearPendingIfNotWatching(set, get, gameId);
        }
      },

      remove: async ({ gameId, appId, workshopId }) => {
        setPending(set, gameId, 'removing');
        try {
          if (appId) {
            const result = await window.electronAPI.setWorkshopSubscription(
              gameId,
              appId,
              workshopId,
              false
            );
            if (result.ok) {
              watchDisk(set, get, { gameId, appId, workshopId, wanted: false });
              return;
            }
          }

          await openWorkshopPage(workshopId);
        } catch (error) {
          console.error('[Workshop] remove failed', error);
        } finally {
          clearPendingIfNotWatching(set, get, gameId);
        }
      },

      reconcile: async (gameId, appId, workshopId) => {
        if (get().pending[gameId]) {
          return;
        }
        const actual = await window.electronAPI.isWorkshopItemDownloaded(
          appId,
          workshopId
        );
        // null — містка немає або API Steam змінилось: кеш лишається як є
        if (actual === null) {
          return;
        }

        if (get().pending[gameId]) {
          return;
        }
        get().setInstalled(gameId, actual);
      },

      reconcileAll: async () => {
        const before = get().installedAt;
        const installed = await window.electronAPI.listInstalledWorkshopGames();
        if (installed === null) {
          return;
        }
        if (get().installedAt !== before) {
          return;
        }
        if (
          installed.length === Object.keys(before).length &&
          installed.every((gameId) => gameId in before)
        ) {
          return;
        }

        const next: Record<string, string> = {};
        for (const gameId of installed) {
          next[gameId] = before[gameId] ?? new Date().toISOString();
        }
        set({ installedAt: next });
      },
    }),
    {
      name: 'workshop-installs-storage',
      storage: createJSONStorage(() => electronStorage),
      partialize: (state) => ({ installedAt: state.installedAt }),
    }
  )
);

type Set_ = (
  fn: (state: WorkshopInstallsStore) => Partial<WorkshopInstallsStore>
) => void;
type Get_ = () => WorkshopInstallsStore;

function setPending(set: Set_, gameId: string, value: WorkshopPending): void {
  set((state) => ({ pending: { ...state.pending, [gameId]: value } }));
}

function clearPending(set: Set_, gameId: string): void {
  set((state) => {
    const pending = { ...state.pending };
    delete pending[gameId];
    return { pending };
  });
}

function clearPendingIfNotWatching(set: Set_, get: Get_, gameId: string): void {
  if (!timers.has(gameId)) {
    clearPending(set, gameId);
  } else if (get().pending[gameId] === 'installing') {
    setPending(set, gameId, 'downloading');
  }
}

function watchDisk(
  set: Set_,
  get: Get_,
  {
    gameId,
    appId,
    workshopId,
    wanted,
  }: { gameId: string; appId: number; workshopId: string; wanted: boolean }
): void {
  clearTimeout(timers.get(gameId));
  const deadline = Date.now() + POLL_LIMIT_MS;
  let unknownStreak = 0;

  function stopWatching(): void {
    timers.delete(gameId);
    clearPending(set, gameId);
  }

  function scheduleNext(): void {
    if (Date.now() >= deadline) {
      stopWatching();
      void get().reconcile(gameId, appId, workshopId);
      return;
    }
    timers.set(gameId, setTimeout(poll, POLL_INTERVAL_MS));
  }

  function poll(): void {
    window.electronAPI
      .isWorkshopItemDownloaded(appId, workshopId)
      .then((installed) => {
        if (installed === wanted) {
          timers.delete(gameId);
          get().setInstalled(gameId, wanted);
          return;
        }
        if (installed === null) {
          unknownStreak += 1;
          if (unknownStreak >= UNKNOWN_STREAK_LIMIT) {
            stopWatching();
            return;
          }
        } else {
          unknownStreak = 0;
        }
        scheduleNext();
      })
      .catch((error: unknown) => {
        console.error('[Workshop] poll failed', error);
        scheduleNext();
      });
  }

  scheduleNext();
}

function trackOpen(gameId: string): void {
  void window.electronAPI
    .trackWorkshopOpen(gameId)
    .catch((error: unknown) => console.error('[Workshop] tracking failed', error));
}

export function subscribeToWorkshopInstalledChanges(listener: () => void): () => void {
  let prev = useWorkshopInstallsStore.getState().installedAt;
  return useWorkshopInstallsStore.subscribe((state) => {
    if (state.installedAt === prev) {
      return;
    }
    prev = state.installedAt;
    listener();
  });
}
