import { isRecord } from './steam-globals';

const ACH_MAX_APPS = 5000;
const ACH_ORIG = '__lbkOrig';

export interface AchText {
  name?: string;
  desc?: string;
}

type AppStrings = Record<string, AchText>;

export interface AchievementsPayload {
  stamp: string | null;
  apps: Record<string, AppStrings>;
}

export function sanitizeAchievements(raw: unknown): AchievementsPayload | null {
  if (!isRecord(raw) || raw.v !== 1 || !isRecord(raw.apps)) {
    return null;
  }
  const apps: Record<string, AppStrings> = Object.create(null);
  let count = 0;
  for (const appid of Object.keys(raw.apps)) {
    const src = raw.apps[appid];
    if (!/^\d{1,10}$/.test(appid) || !isRecord(src) || ++count > ACH_MAX_APPS) {
      continue;
    }
    const out: AppStrings = Object.create(null);
    for (const api of Object.keys(src)) {
      const e = src[api];
      if (api.length > 256 || !isRecord(e)) {
        continue;
      }
      const t: AchText = Object.create(null);
      if (typeof e.name === 'string' && e.name.length > 0 && e.name.length <= 2048) {
        t.name = e.name;
      }
      if (typeof e.desc === 'string' && e.desc.length > 0 && e.desc.length <= 4096) {
        t.desc = e.desc;
      }
      if (t.name || t.desc) {
        out[api] = t;
      }
    }
    apps[appid] = out;
  }
  const stamp =
    typeof raw.stamp === 'string' || typeof raw.stamp === 'number'
      ? String(raw.stamp)
      : null;
  return { stamp, apps };
}

// Rewrites achievement records in Steam's own objects in place, remembering the originals for revert.
export function createTextPatcher(data: Map<string, AppStrings>) {
  const has = (appid: unknown): boolean =>
    appid !== undefined && appid !== null && data.has(String(appid));
  const lookup = (appid: unknown, id: unknown): AchText | undefined => {
    if (id === undefined || id === null) {
      return undefined;
    }
    return data.get(String(appid))?.[String(id)];
  };

  const patchRecord = (
    appid: unknown,
    rec: Record<string, unknown>,
    keyHint: string | undefined,
    revert: boolean
  ): void => {
    const nameKey = 'strName' in rec ? 'strName' : 'name';
    const descKey = 'strDescription' in rec ? 'strDescription' : 'desc';
    const orig = rec[ACH_ORIG];
    if (revert) {
      if (isRecord(orig)) {
        rec[nameKey] = orig.n;
        rec[descKey] = orig.d;
        delete rec[ACH_ORIG];
      }
      return;
    }
    const id =
      rec.strID !== undefined ? rec.strID : rec.id !== undefined ? rec.id : keyHint;
    const t = lookup(appid, id);
    if (!t) {
      return;
    }
    if (!orig) {
      // Non-enumerable, so it never leaks into JSON Steam persists.
      Object.defineProperty(rec, ACH_ORIG, {
        value: { n: rec[nameKey], d: rec[descKey] },
        configurable: true,
      });
    }
    if (t.name) {
      rec[nameKey] = t.name;
    }
    if (t.desc) {
      rec[descKey] = t.desc;
    }
  };
  const walk = (
    appid: unknown,
    node: unknown,
    revert: boolean,
    depth: number,
    keyHint?: string
  ): void => {
    if (!isRecord(node) || depth > 6) {
      return;
    }
    if (Array.isArray(node)) {
      for (const x of node) {
        walk(appid, x, revert, depth + 1);
      }
      return;
    }
    if (typeof node.strName === 'string' || typeof node.strDescription === 'string') {
      try {
        patchRecord(appid, node, keyHint, revert);
      } catch {
        // A frozen record stays untranslated; its siblings still get patched.
      }
      return;
    }
    for (const k of Object.keys(node)) {
      walk(appid, node[k], revert, depth + 1, k);
    }
  };

  return { has, lookup, walk };
}
