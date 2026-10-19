import { A, D, F, G } from '@mobily/ts-belt';
import { installActivityHooks } from './achievement-activity';
import {
  type AchievementQueries,
  hookAchievementQueries,
  isQueryClient,
} from './achievement-query-cache';
import {
  type AchievementsPayload,
  type AchText,
  createTextPatcher,
} from './achievement-text';
import { type AnyFn, isFn, type SteamGlobals } from './steam-globals';
import { findWebpackExports, steamWebpackRequire } from './steam-webpack';

const ACH_KEY = Symbol.for('lbk.achievementStrings');
// A plugin update reloads into a SharedJSContext that still holds the previous hook; a new version replaces it.
const ACH_VERSION = 3;
const ACHIEVEMENTS_KEY = 'achievements';
const ACHIEVEMENT_MAP_KEY = 'achievementmap';

interface HookReport {
  state: 'ok';
  version: number;
  stamp: string | null;
  apps: number;
  coverage: Record<string, boolean>;
}

export interface AchievementsHook {
  version: number;
  readonly stamp: string | null;
  replaceData(payload: AchievementsPayload | null): void;
  report(): HookReport;
  uninstall(): void;
}

interface MobxMap {
  delete(key: unknown): unknown;
}

interface AchievementStore {
  m_mapMyAchievements: MobxMap;
  m_mapGlobalAchievements?: MobxMap;
}

interface ToastClass {
  new (): unknown;
  prototype: Record<string, unknown>;
}

// Any thenable: G.isPromise is only instanceof Promise.
const isThenable = (v: unknown): v is PromiseLike<unknown> =>
  G.isObject(v) && isFn(v.then);
const isHook = (v: unknown): v is AchievementsHook =>
  G.isObject(v) && G.isNumber(v.version) && isFn(v.replaceData) && isFn(v.report);

const isAchievementStore = (v: unknown): v is AchievementStore =>
  G.isObject(v) &&
  G.isObject(v.m_mapMyAchievements) &&
  isFn(v.m_mapMyAchievements.delete);

const isToastClass = (v: unknown): v is ToastClass =>
  isFn(v) &&
  G.isObject(v.prototype) &&
  isFn(v.prototype.getClassName) &&
  v.prototype.getClassName() === 'CClientNotificationAchievement';

// Reads a protobuf accessor such as this.appid(); a missing accessor reads as its own value.
function readAccessor(target: unknown, key: string): unknown {
  const value = G.isObject(target) ? target[key] : undefined;
  return isFn(value) ? value.call(target) : value;
}

export function installAchievementsHook(g: SteamGlobals): AchievementsHook {
  const win: object = g.window ?? g;
  const prev: unknown = Reflect.get(win, ACH_KEY);
  if (isHook(prev) && prev.version === ACH_VERSION) {
    return prev;
  }
  try {
    if (G.isObject(prev) && isFn(prev.uninstall)) {
      prev.uninstall();
    }
  } catch {
    // An older hook that cannot uninstall must not block ours.
  }

  const data = new Map<string, AchievementsPayload['apps'][string]>();
  const { has, lookup, walk, copyOriginal, copyTranslated } = createTextPatcher(data);
  const undo: (() => void)[] = [];
  const coverage: Record<string, boolean> = {};
  let stamp: string | null = null;

  const safe = (fn: () => void): void => {
    try {
      fn();
    } catch (e) {
      console.warn('[LBK] achievements hook', e);
    }
  };
  const wrap = (
    obj: object | null | undefined,
    key: string,
    make: (orig: AnyFn) => AnyFn,
    label: string
  ): void => {
    try {
      const orig: unknown = obj ? Reflect.get(obj, key) : undefined;
      if (!obj || !isFn(orig)) {
        coverage[label] = false;
        return;
      }
      const hadOwn = Object.hasOwn(obj, key);
      const w = make(orig);
      Reflect.set(obj, key, w);
      if (Reflect.get(obj, key) !== w) {
        coverage[label] = false;
        return;
      }
      undo.push(() => {
        if (Reflect.get(obj, key) === w) {
          if (hadOwn) {
            Reflect.set(obj, key, orig);
          } else {
            Reflect.deleteProperty(obj, key);
          }
        }
      });
      coverage[label] = true;
    } catch {
      coverage[label] = false;
    }
  };

  let req: ReturnType<typeof steamWebpackRequire> = null;
  safe(() => {
    req = steamWebpackRequire(g);
  });
  const { achStore, ToastData, queryClient } = findWebpackExports(req, {
    // A MobX ObservableMap, not a Map instance.
    achStore: { marker: 'LoadMyAchievements', pred: isAchievementStore },
    ToastData: { marker: 'CClientNotificationAchievement', pred: isToastClass },
    // The module that creates the shared client also mounts its devtools.
    queryClient: { marker: 'ReactQueryDevtools', pred: isQueryClient },
  });
  coverage.achStore = Boolean(achStore);
  let queries: AchievementQueries | null = null;
  safe(() => {
    queries = queryClient ? hookAchievementQueries(queryClient, has, lookup) : null;
  });
  coverage.queryClient = Boolean(queries);
  const activity = installActivityHooks({ g, wrap, safe, has, lookup });

  const afterResult = (o: AnyFn): AnyFn =>
    function (this: unknown, appid: unknown, ...rest: unknown[]) {
      const r = o.call(this, appid, ...rest);
      if (!has(appid)) {
        return r;
      }
      const patch = (v: unknown): unknown => {
        safe(() =>
          walk(appid, G.isObject(v) && v.data !== undefined ? v.data : v, false, 0)
        );
        return v;
      };
      return isThenable(r) ? r.then(patch) : patch(r);
    };

  const steamApps = g.SteamClient?.Apps;
  wrap(steamApps, 'GetMyAchievementsForApp', afterResult, 'library');
  wrap(steamApps, 'GetFriendAchievementsForApp', afterResult, 'friends');
  wrap(steamApps, 'GetAchievementsInTimeRange', afterResult, 'timeline');
  wrap(
    g.appDetailsCache,
    'SetCachedDataForApp',
    (o) =>
      function (
        this: unknown,
        appid: unknown,
        key: unknown,
        ver: unknown,
        value: unknown,
        ...rest: unknown[]
      ) {
        // Every save writes all of an app's cached keys to disk, so the cache keeps Steam's own strings and reads translate.
        let stored = value;
        if (key === ACHIEVEMENT_MAP_KEY && G.isString(value)) {
          safe(() => {
            stored = activity.saveCache(value);
          });
        } else if (key === ACHIEVEMENTS_KEY && has(appid)) {
          safe(() => {
            stored = copyOriginal(value);
            // AppDetailsChanged hands the same details to its listeners after this call.
            walk(appid, value, false, 0);
          });
        }
        const r = o.call(this, appid, key, ver, stored, ...rest);
        if (key === ACHIEVEMENTS_KEY && has(appid)) {
          // AppDetailsChanged stores a MobX copy of the details just before this call; the UI renders that copy.
          patchDetails([String(appid)], false);
        }
        return r;
      },
    'appDetails'
  );
  // Without the save wrapper a translated read would reach the disk with the next save.
  wrap(
    coverage.appDetails ? g.appDetailsCache : null,
    'LookupCachedDataForApp',
    (o) =>
      function (this: unknown, appid: unknown, key: unknown, ...rest: unknown[]) {
        const r = o.call(this, appid, key, ...rest);
        let out: unknown = r;
        if (key === ACHIEVEMENT_MAP_KEY && G.isString(r)) {
          safe(() => {
            out = activity.readCache(r);
          });
        } else if (key === ACHIEVEMENTS_KEY && has(appid) && G.isObject(r)) {
          safe(() => {
            out = copyTranslated(appid, r);
          });
        }
        return out;
      },
    'cachedReads'
  );
  coverage.activityCards = coverage.appDetails === true && coverage.cachedReads === true;

  if (ToastData && !isFn(ToastData.prototype.name)) {
    // Protobuf message classes define their accessors on the prototype on first construction.
    safe(() => new ToastData());
  }
  for (const [method, field] of [
    ['name', 'name'],
    ['description', 'desc'],
  ] as const) {
    wrap(
      ToastData?.prototype,
      method,
      (o) =>
        function (this: unknown, ...args: unknown[]) {
          const v = o.apply(this, args);
          if (args.length > 0) {
            return v;
          }
          let t: AchText | undefined;
          safe(() => {
            t = lookup(readAccessor(this, 'appid'), readAccessor(this, 'achievement_id'));
          });
          return t?.[field] || v;
        },
      `toast.${method}`
    );
  }
  if (!coverage['toast.name'] && G.isObject(g.NotificationStore)) {
    // Achievement toast payloads are protobuf messages; patch them on the way in instead.
    wrap(
      g.NotificationStore,
      'ProcessNotification',
      (o) =>
        function (this: unknown, notif: unknown, ...rest: unknown[]) {
          safe(() => {
            const d = G.isObject(notif) && notif.eType === 5 ? notif.data : null;
            if (G.isObject(d) && isFn(d.appid) && isFn(d.achievement_id)) {
              const t = lookup(d.appid.call(d), d.achievement_id.call(d));
              if (t?.name && isFn(d.set_name)) {
                d.set_name.call(d, t.name);
              }
              if (t?.desc && isFn(d.set_description)) {
                d.set_description.call(d, t.desc);
              }
            }
          });
          return o.call(this, notif, ...rest);
        },
      'toastFallback'
    );
  }

  const invalidate = (appids: Iterable<unknown>): void => {
    for (const id of appids) {
      for (const k of [Number(id), String(id)]) {
        safe(() => {
          achStore?.m_mapMyAchievements.delete(k);
          achStore?.m_mapGlobalAchievements?.delete(k);
        });
      }
    }
  };
  const patchDetails = (appids: Iterable<string>, revert: boolean): void => {
    const store = g.appDetailsStore;
    for (const id of appids) {
      safe(() => {
        const details = store?.GetAppDetails?.(Number(id));
        walk(id, details?.achievements, revert, 0);
      });
    }
  };

  const api: AchievementsHook = {
    version: ACH_VERSION,
    get stamp() {
      return stamp;
    },
    replaceData(p) {
      const next = new Map(D.toPairs(p?.apps ?? {}));
      const ids = new Set([...data.keys(), ...next.keys()]);
      // LBK replays the whole file on every change; only apps whose strings changed are touched.
      const changed = new Set(
        A.reject([...ids], (id) => F.equals(data.get(id), next.get(id)))
      );
      stamp = p ? p.stamp : null;
      if (changed.size === 0) {
        return;
      }
      patchDetails(changed, true);
      data.clear();
      for (const [k, v] of next) {
        data.set(k, v);
      }
      patchDetails(changed, false);
      safe(() => activity.patch(changed, false));
      safe(() => queries?.sync(changed));
      invalidate(changed);
    },
    report() {
      return {
        state: 'ok',
        version: ACH_VERSION,
        stamp,
        apps: data.size,
        coverage: { ...coverage, queryCacheSchema: queries?.seen() ?? false },
      };
    },
    uninstall() {
      const all = [...data.keys()];
      patchDetails(all, true);
      safe(() => activity.patch(new Set(all), true));
      safe(() => queries?.dispose());
      for (const restore of undo.splice(0).reverse()) {
        safe(restore);
      }
      data.clear();
      invalidate(all);
      Reflect.deleteProperty(win, ACH_KEY);
    },
  };
  Object.defineProperty(win, ACH_KEY, { value: api, configurable: true });
  return api;
}
