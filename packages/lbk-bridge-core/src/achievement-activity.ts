import type { AchText } from './achievement-text';
import { isRecord } from './steam-globals';

type Lookup = (appid: unknown, id: unknown) => AchText | undefined;

interface Original {
  name: unknown;
  desc: unknown;
}

export interface ActivityStore {
  m_mapAppActivity: { values(): Iterable<unknown> };
}

export const isActivityStore = (v: unknown): v is ActivityStore =>
  isRecord(v) &&
  isRecord(v.m_mapAppActivity) &&
  typeof v.m_mapAppActivity.values === 'function';

const mapValues = (v: unknown): unknown[] =>
  v instanceof Map || (isRecord(v) && typeof v.values === 'function')
    ? [...(v as { values(): Iterable<unknown> }).values()]
    : [];

// Activity cards show achievements from an app's achievement map: { strID, strName, strDescription } per achievement.
export function createActivityTranslator(lookup: Lookup) {
  const originals = new Map<string, Original>();

  const record = (appid: unknown, rec: unknown, revert: boolean): boolean => {
    if (!isRecord(rec) || typeof rec.strID !== 'string') {
      return false;
    }
    const t = lookup(appid, rec.strID);
    if (!t) {
      return false;
    }
    const key = `${String(appid)}\u0000${rec.strID}`;
    const name = t.name ?? rec.strName;
    const desc = t.desc ?? rec.strDescription;
    if (revert) {
      const o = originals.get(key);
      if (!o || (rec.strName !== name && rec.strDescription !== desc)) {
        return false;
      }
      rec.strName = o.name;
      rec.strDescription = o.desc;
      return true;
    }
    if (rec.strName === name && rec.strDescription === desc) {
      return false;
    }
    originals.set(key, { name: rec.strName, desc: rec.strDescription });
    rec.strName = name;
    rec.strDescription = desc;
    return true;
  };

  // Steam caches the map as JSON [[appid, [[apiName, record], ...]], ...]; the inner appid owns the strings.
  const mapJson = (json: string, revert: boolean): string => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(json);
    } catch {
      return json;
    }
    if (!Array.isArray(parsed)) {
      return json;
    }
    let changed = false;
    for (const app of parsed) {
      if (!Array.isArray(app) || !Array.isArray(app[1])) {
        continue;
      }
      for (const entry of app[1]) {
        if (Array.isArray(entry) && record(app[0], entry[1], revert)) {
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

  // Patches the maps and the cards already built from them; cards copy their records, so both need it.
  const patchStore = (
    store: ActivityStore,
    appids: Set<string>,
    revert: boolean
  ): void => {
    for (const activity of mapValues(store.m_mapAppActivity)) {
      if (!isRecord(activity)) {
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
        for (const card of isRecord(day) ? mapValues(day.m_mapAchievementsByUser) : []) {
          const appid = isRecord(card) ? Number(card.gameid) : NaN;
          if (
            isRecord(card) &&
            Array.isArray(card.m_rgAchievements) &&
            appids.has(String(appid))
          ) {
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
