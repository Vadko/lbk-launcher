import {
  type AchievementsPayload,
  type AchText,
  createTextPatcher,
} from './achievement-text';
import { type AnyFn, isFn, isRecord, type SteamGlobals } from './steam-globals';
import { findWebpackExport, steamWebpackRequire } from './steam-webpack';

const ACH_KEY = Symbol.for('lbk.achievementStrings');
const ACH_VERSION = 1;

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

const isThenable = (v: unknown): v is PromiseLike<unknown> => isRecord(v) && isFn(v.then);
const isHook = (v: unknown): v is AchievementsHook =>
  isRecord(v) && typeof v.version === 'number' && isFn(v.replaceData) && isFn(v.report);

const isAchievementStore = (v: unknown): v is AchievementStore =>
  isRecord(v) && isRecord(v.m_mapMyAchievements) && isFn(v.m_mapMyAchievements.delete);

const isToastClass = (v: unknown): v is ToastClass =>
  isFn(v) &&
  isRecord(v.prototype) &&
  isFn(v.prototype.getClassName) &&
  v.prototype.getClassName() === 'CClientNotificationAchievement';

// Reads a protobuf accessor such as this.appid(); a missing accessor reads as its own value.
function readAccessor(target: unknown, key: string): unknown {
  const value = isRecord(target) ? target[key] : undefined;
  return isFn(value) ? value.call(target) : value;
}

export function installAchievementsHook(g: SteamGlobals): AchievementsHook {
  const win: object = g.window ?? g;
  const prev: unknown = Reflect.get(win, ACH_KEY);
  if (isHook(prev) && prev.version === ACH_VERSION) {
    return prev;
  }
  try {
    if (isRecord(prev) && isFn(prev.uninstall)) {
      prev.uninstall();
    }
  } catch {
    // An older hook that cannot uninstall must not block ours.
  }

  const data = new Map<string, AchievementsPayload['apps'][string]>();
  const { has, lookup, walk } = createTextPatcher(data);
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
      const hadOwn = Object.prototype.hasOwnProperty.call(obj, key);
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
  // A MobX ObservableMap, not a Map instance.
  const achStore = findWebpackExport(req, 'LoadMyAchievements', isAchievementStore);
  coverage.achStore = Boolean(achStore);
  const ToastData = findWebpackExport(
    req,
    'CClientNotificationAchievement',
    isToastClass
  );

  const afterResult = (o: AnyFn): AnyFn =>
    function (this: unknown, appid: unknown, ...rest: unknown[]) {
      const r = o.call(this, appid, ...rest);
      if (!has(appid)) {
        return r;
      }
      const patch = (v: unknown): unknown => {
        safe(() =>
          walk(appid, isRecord(v) && v.data !== undefined ? v.data : v, false, 0)
        );
        return v;
      };
      return isThenable(r) ? r.then(patch) : patch(r);
    };
  const patchJson = (appid: unknown, r: unknown): unknown => {
    if (typeof r !== 'string' || !has(appid)) {
      return r;
    }
    try {
      const j: unknown = JSON.parse(r);
      walk(appid, j, false, 0);
      return JSON.stringify(j);
    } catch {
      return r;
    }
  };

  const steamApps = g.SteamClient?.Apps;
  wrap(steamApps, 'GetMyAchievementsForApp', afterResult, 'library');
  wrap(steamApps, 'GetFriendAchievementsForApp', afterResult, 'friends');
  wrap(steamApps, 'GetAchievementsInTimeRange', afterResult, 'timeline');
  wrap(
    steamApps,
    'GetCachedAppDetails',
    (o) =>
      function (this: unknown, appid: unknown, ...rest: unknown[]) {
        const r = o.call(this, appid, ...rest);
        return isThenable(r) ? r.then((v) => patchJson(appid, v)) : patchJson(appid, r);
      },
    'cachedDetails'
  );
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
        if (has(appid)) {
          safe(() => walk(appid, value, false, 0));
        }
        const r = o.call(this, appid, key, ver, value, ...rest);
        if (key === 'achievements' && has(appid)) {
          // AppDetailsChanged stores a MobX copy of the details just before this call; the UI renders that copy.
          safe(() => patchLoaded([appid], false));
        }
        return r;
      },
    'appDetails'
  );

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
  if (!coverage['toast.name'] && isRecord(g.NotificationStore)) {
    // Achievement toast payloads are protobuf messages; patch them on the way in instead.
    wrap(
      g.NotificationStore,
      'ProcessNotification',
      (o) =>
        function (this: unknown, notif: unknown, ...rest: unknown[]) {
          safe(() => {
            const d = isRecord(notif) && notif.eType === 5 ? notif.data : null;
            if (isRecord(d) && isFn(d.appid) && isFn(d.achievement_id)) {
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
  const patchLoaded = (appids: Iterable<unknown>, revert: boolean): void => {
    const store = g.appDetailsStore;
    if (!store || typeof store.GetAppDetails !== 'function') {
      return;
    }
    for (const id of appids) {
      safe(() => {
        const details = store.GetAppDetails?.(Number(id));
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
      const next = new Map(Object.entries(p?.apps || {}));
      const touched = new Set([...data.keys(), ...next.keys()]);
      patchLoaded(touched, true);
      data.clear();
      for (const [k, v] of next) {
        data.set(k, v);
      }
      patchLoaded(touched, false);
      invalidate(touched);
      stamp = p ? p.stamp : null;
    },
    report() {
      return {
        state: 'ok',
        version: ACH_VERSION,
        stamp,
        apps: data.size,
        coverage: { ...coverage },
      };
    },
    uninstall() {
      const all = [...data.keys()];
      patchLoaded(all, true);
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
