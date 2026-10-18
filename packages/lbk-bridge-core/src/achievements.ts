import { type AchievementsPayload, sanitizeAchievements } from './achievement-text';
import { type AchievementsHook, installAchievementsHook } from './achievements-hook';
import type { AchievementsHookReport, OpHandlers, PluginOnlySteamOps } from './contract';
import { isRecord, type SteamGlobals } from './steam-globals';

const ACH_POLL_MS = 1000;
const ACH_READY_TIMEOUT_MS = 5 * 60 * 1000;

function achievementsEnvReady(g: SteamGlobals, minimal: boolean): boolean {
  const hasApps = isRecord(g.SteamClient) && isRecord(g.SteamClient.Apps);
  if (minimal) {
    return hasApps;
  }
  return (
    hasApps &&
    isRecord(g.appDetailsStore) &&
    isRecord(g.appDetailsCache) &&
    Array.isArray(g.window?.webpackChunksteamui)
  );
}

interface AchievementsDeps {
  steam: SteamGlobals;
  readJson: (name: string) => Promise<unknown>;
  sleep: (ms: number) => Promise<void>;
  isDisposed: () => boolean;
  errText: (e: unknown) => string;
}

export interface Achievements {
  start(): Promise<void>;
  report(): AchievementsHookReport;
  ops: OpHandlers<PluginOnlySteamOps>;
  dispose(): void;
}

// Rewrites achievement strings in Steam's UI from achievements.json.
export function createAchievements(deps: AchievementsDeps): Achievements {
  const startedAt = Date.now();
  let state: AchievementsHookReport['state'] = 'not-ready';
  let error: string | null = null;
  let hook: AchievementsHook | null = null;
  let loop: Promise<void> | null = null;
  let reloadRequested = false;

  const loadAchievementsFile = async (): Promise<AchievementsPayload | null> => {
    let lastError: unknown = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        return sanitizeAchievements(await deps.readJson('achievements.json'));
      } catch (e) {
        lastError = e;
        await deps.sleep(2000);
      }
    }
    throw lastError;
  };

  const applyAchievements = (payload: AchievementsPayload | null): void => {
    if (deps.isDisposed()) {
      return;
    }
    const apps = payload ? payload.apps : {};
    // No translations, no hooks: leave Steam untouched until there is something to show.
    if (!hook && Object.keys(apps).length === 0) {
      return;
    }
    hook ??= installAchievementsHook(deps.steam);
    hook.replaceData({ stamp: payload ? payload.stamp : null, apps });
  };

  const reload = async (): Promise<void> => {
    applyAchievements(await loadAchievementsFile());
    state = 'ok';
    error = null;
  };

  // Millennium injects plugins right after App.BFinishedInitBeforeLogin, before the stores exist.
  const start = (): Promise<void> => {
    if (loop) {
      return loop;
    }
    loop = (async () => {
      while (!achievementsEnvReady(deps.steam, false)) {
        if (deps.isDisposed()) {
          return;
        }
        if (Date.now() - startedAt >= ACH_READY_TIMEOUT_MS) {
          if (achievementsEnvReady(deps.steam, true)) {
            break;
          }
          state = 'failed';
          error = 'steam ui not ready';
          return;
        }
        await deps.sleep(ACH_POLL_MS);
      }
      try {
        do {
          reloadRequested = false;
          await reload();
        } while (reloadRequested && !deps.isDisposed());
      } catch (e) {
        state = 'failed';
        error = deps.errText(e);
      }
    })().finally(() => {
      loop = null;
    });
    return loop;
  };

  const report = (): AchievementsHookReport => {
    const r = hook ? hook.report() : { stamp: null, apps: 0, coverage: {} };
    const out: AchievementsHookReport = {
      state,
      stamp: r.stamp,
      apps: r.apps,
      coverage: r.coverage,
    };
    if (error) {
      out.error = error;
    }
    return out;
  };

  const ops: OpHandlers<PluginOnlySteamOps> = {
    achievementsReload: async () => {
      if (loop) {
        // The startup loop reads achievements.json once Steam's stores exist, and again if asked meanwhile.
        reloadRequested = true;
        return { apps: 0, coverage: {} };
      }
      if (!achievementsEnvReady(deps.steam, state === 'failed')) {
        void start();
        return { apps: 0, coverage: {} };
      }
      await reload();
      const r = report();
      return { apps: r.apps, coverage: r.coverage };
    },
    achievementsStatus: async () => report(),
  };

  const dispose = (): void => {
    const current = hook;
    hook = null;
    if (current) {
      try {
        current.uninstall();
      } catch (e) {
        console.warn('[LBK] achievements hook uninstall', e);
      }
    }
  };

  return { start, report, ops, dispose };
}
