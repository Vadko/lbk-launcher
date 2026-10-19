import { F, G } from '@mobily/ts-belt';
import pLimit from 'p-limit';
import pWaitFor from 'p-wait-for';
import {
  type AchievementsPayload,
  type AppStrings,
  sanitizeAchievements,
} from './achievement-text';
import { type AchievementsHook, installAchievementsHook } from './achievements-hook';
import type { AchievementsHookReport, OpHandlers, PluginOnlySteamOps } from './contract';
import type { SteamGlobals } from './steam-globals';

const ACH_POLL_MS = 1000;
const ACH_READY_TIMEOUT_MS = 5 * 60 * 1000;
const ACH_FILE_ATTEMPTS = 3;
const ACH_FILE_RETRY_MS = 2000;
const PAGE_STRINGS_POLL_MS = 250;
// A page module applies strings that arrive late, so a page asking during startup can wait for the first read.
const PAGE_STRINGS_WAIT_MS = 30_000;

function achievementsEnvReady(g: SteamGlobals, minimal: boolean): boolean {
  const hasApps = G.isObject(g.SteamClient) && G.isObject(g.SteamClient.Apps);
  if (minimal) {
    return hasApps;
  }
  return (
    hasApps &&
    G.isObject(g.appDetailsStore) &&
    G.isObject(g.appDetailsCache) &&
    G.isArray(g.window?.webpackChunksteamui)
  );
}

interface AchievementsDeps {
  steam: SteamGlobals;
  readJson: (name: string) => Promise<unknown>;
  delay: (ms: number) => Promise<void>;
  signal: AbortSignal;
  errText: (e: unknown) => string;
}

export interface Achievements {
  start(): void;
  report(): AchievementsHookReport;
  // One app of the last achievements.json read, for Steam web pages.
  strings(appid: string): Promise<AppStrings | undefined>;
  ops: OpHandlers<PluginOnlySteamOps>;
  dispose(): void;
}

// Rewrites achievement strings in Steam's UI from achievements.json.
export function createAchievements(deps: AchievementsDeps): Achievements {
  const startedAt = Date.now();
  let state: AchievementsHookReport['state'] = 'not-ready';
  let error: string | null = null;
  let hook: AchievementsHook | null = null;
  let latest: AchievementsPayload | null = null;
  // A reload asked for during a run queues at most one more run.
  const runs = pLimit(1);
  const busy = () => runs.activeCount + runs.pendingCount > 0;

  const loadAchievementsFile = async (): Promise<AchievementsPayload | null> => {
    for (let attempt = 1; ; attempt++) {
      try {
        return sanitizeAchievements(await deps.readJson('achievements.json'));
      } catch (e) {
        if (attempt >= ACH_FILE_ATTEMPTS) {
          throw e;
        }
      }
      await deps.delay(ACH_FILE_RETRY_MS);
      deps.signal.throwIfAborted();
    }
  };

  const applyAchievements = (payload: AchievementsPayload | null): void => {
    if (deps.signal.aborted) {
      return;
    }
    latest = payload;
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
  const steamUiReady = async (): Promise<boolean> => {
    await pWaitFor(() => achievementsEnvReady(deps.steam, false), {
      interval: ACH_POLL_MS,
      timeout: {
        milliseconds: Math.max(0, ACH_READY_TIMEOUT_MS - (Date.now() - startedAt)),
        fallback: F.ignore,
      },
      signal: deps.signal,
    });
    // Past the deadline SteamClient.Apps alone is enough for the hooks that need nothing else.
    return achievementsEnvReady(deps.steam, true);
  };

  const run = async (): Promise<void> => {
    try {
      if (!(await steamUiReady())) {
        state = 'failed';
        error = 'steam ui not ready';
        return;
      }
      await reload();
    } catch (e) {
      if (!deps.signal.aborted) {
        state = 'failed';
        error = deps.errText(e);
      }
    }
  };

  const start = (): void => {
    if (!busy()) {
      void runs(run);
    }
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

  const strings = async (appid: string): Promise<AppStrings | undefined> => {
    await pWaitFor(() => state !== 'not-ready', {
      interval: PAGE_STRINGS_POLL_MS,
      timeout: { milliseconds: PAGE_STRINGS_WAIT_MS, fallback: F.ignore },
      signal: deps.signal,
    });
    return latest && Object.hasOwn(latest.apps, appid) ? latest.apps[appid] : undefined;
  };

  const ops: OpHandlers<PluginOnlySteamOps> = {
    achievementsReload: async () => {
      if (busy()) {
        // The running pass reads achievements.json once Steam's stores exist, and once more if asked meanwhile.
        if (runs.pendingCount === 0) {
          void runs(run);
        }
        return { apps: 0, coverage: {} };
      }
      if (!achievementsEnvReady(deps.steam, state === 'failed')) {
        start();
        return { apps: 0, coverage: {} };
      }
      await runs(reload);
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

  return { start, report, strings, ops, dispose };
}
