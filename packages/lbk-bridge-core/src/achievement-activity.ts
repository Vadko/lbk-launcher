import { G, R } from '@mobily/ts-belt';
import { type AchLookup, type AchText, createTextMemory } from './achievement-text';
import { type AnyFn, isFn, type SteamGlobals } from './steam-globals';

interface HasValues {
  values(): Iterable<unknown>;
}

interface ActivityStore {
  m_mapAppActivity: HasValues;
}

interface ActivityHookDeps {
  g: SteamGlobals;
  wrap: (
    obj: object | null | undefined,
    key: string,
    make: (orig: AnyFn) => AnyFn,
    label: string
  ) => void;
  safe: (fn: () => void) => void;
  has: (appid: unknown) => boolean;
  lookup: AchLookup;
}

const FIELDS: readonly (readonly [string, keyof AchText])[] = [
  ['strName', 'name'],
  ['strDescription', 'desc'],
];

// Maps, MobX ObservableMaps and arrays alike.
const hasValues = (v: unknown): v is HasValues =>
  (G.isObject(v) || G.isArray(v)) && isFn(v.values);

const isActivityStore = (v: unknown): v is ActivityStore =>
  G.isObject(v) && hasValues(v.m_mapAppActivity);

const mapValues = (v: unknown): unknown[] => (hasValues(v) ? [...v.values()] : []);

// Activity cards show achievements from an app's achievement map: { strID, strName, strDescription } per achievement.
export function createActivityTranslator(lookup: AchLookup) {
  const memory = createTextMemory();

  const record = (appid: unknown, rec: unknown, revert: boolean): boolean => {
    if (!G.isObject(rec) || !G.isString(rec.strID)) {
      return false;
    }
    const t = revert ? undefined : lookup(appid, rec.strID);
    let changed = false;
    for (const [key, field] of FIELDS) {
      const current = rec[key];
      if (!G.isString(current)) {
        continue;
      }
      const text = memory.show(appid, rec.strID, field, current, t?.[field]);
      if (text !== current) {
        rec[key] = text;
        changed = true;
      }
    }
    return changed;
  };

  // Steam caches the map as JSON [[appid, [[apiName, record], ...]], ...]; the inner appid owns the strings.
  const mapJson = (json: string, revert: boolean): string => {
    const parsed = R.toUndefined(R.fromExecution((): unknown => JSON.parse(json)));
    if (!G.isArray(parsed)) {
      return json;
    }
    let changed = false;
    for (const app of parsed) {
      if (!G.isArray(app) || !G.isArray(app[1])) {
        continue;
      }
      for (const entry of app[1]) {
        if (G.isArray(entry) && record(app[0], entry[1], revert)) {
          changed = true;
        }
      }
    }
    return changed ? JSON.stringify(parsed) : json;
  };

  const patchMap = (recs: unknown, appid: unknown): void => {
    for (const rec of mapValues(recs)) {
      record(appid, rec, false);
    }
  };

  // Cards copy their records from the maps, so both need it; neither is observable, so cards on screen update on their next render.
  const patchStore = (
    store: ActivityStore,
    appids: Set<string>,
    revert: boolean
  ): void => {
    for (const activity of mapValues(store.m_mapAppActivity)) {
      if (!G.isObject(activity)) {
        continue;
      }
      if (activity.m_AchievementMap instanceof Map) {
        for (const [appid, recs] of activity.m_AchievementMap) {
          if (appids.has(String(appid))) {
            for (const rec of mapValues(recs)) {
              record(appid, rec, revert);
            }
          }
        }
      }
      for (const day of mapValues(activity.m_mapActivityByDay)) {
        const cards = G.isObject(day) ? mapValues(day.m_mapAchievementsByUser) : [];
        for (const card of cards) {
          if (!G.isObject(card) || !G.isArray(card.m_rgAchievements)) {
            continue;
          }
          const appid = Number(card.gameid);
          if (appids.has(String(appid))) {
            for (const rec of card.m_rgAchievements) {
              record(appid, rec, revert);
            }
          }
        }
      }
    }
  };

  return { mapJson, patchMap, patchStore };
}

export function installActivityHooks({ g, wrap, safe, has, lookup }: ActivityHookDeps) {
  const translator = createActivityTranslator(lookup);
  const store = (): ActivityStore | null =>
    isActivityStore(g.appActivityStore) ? g.appActivityStore : null;

  // The activity class is module-private; its instances in the store lead to it before any server merge.
  let classHooked = false;
  const hookClass = (): void => {
    const s = store();
    if (classHooked || !s) {
      return;
    }
    for (const instance of s.m_mapAppActivity.values()) {
      const ctor: unknown = G.isObject(instance) ? instance.constructor : undefined;
      if (!isFn(ctor) || !isFn(Reflect.get(ctor, 'BuildAchievementMapFromProto'))) {
        continue;
      }
      classHooked = true;
      wrap(
        ctor,
        'BuildAchievementMapFromProto',
        (o) =>
          function (this: unknown, recs: unknown, appid: unknown, ...rest: unknown[]) {
            const r = o.call(this, recs, appid, ...rest);
            if (has(appid)) {
              safe(() => translator.patchMap(recs, appid));
            }
            return r;
          },
        'activityProto'
      );
      return;
    }
  };
  safe(hookClass);
  // Both merge server news into an activity the store already holds.
  for (const [method, label] of [
    ['FetchLatestActivityFromServer', 'activityFeed'],
    ['FetchActivityHistory', 'activityHistory'],
  ] as const) {
    wrap(
      store(),
      method,
      (o) =>
        function (this: unknown, ...args: unknown[]) {
          safe(hookClass);
          return o.apply(this, args);
        },
      label
    );
  }

  return {
    readCache: (json: string): string => translator.mapJson(json, false),
    saveCache: (json: string): string => translator.mapJson(json, true),
    patch(appids: Set<string>, revert: boolean): void {
      const s = store();
      if (s) {
        translator.patchStore(s, appids, revert);
      }
    },
  };
}
