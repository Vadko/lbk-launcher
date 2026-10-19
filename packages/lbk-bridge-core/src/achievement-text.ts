import { A, D, G, O, pipe } from '@mobily/ts-belt';
import * as z from 'zod/mini';
import { ACH_MAX_APPS, toAppStrings } from './achievement-page-sources';

const ACH_ORIG = '__lbkOrig';
const APP_ID = /^\d{1,10}$/;

export interface AchText {
  name?: string;
  desc?: string;
}

export type AppStrings = Record<string, AchText>;

export interface AchievementsPayload {
  stamp: string | null;
  apps: Record<string, AppStrings>;
}

export type AchLookup = (appid: unknown, id: unknown) => AchText | undefined;

const stampSchema = z.union([z.string(), z.number()]);

const achievementsFileSchema = z.object({
  v: z.literal(1),
  stamp: z.optional(z.unknown()),
  apps: z.looseObject({}),
});

// Ids come from Steam: an id like "constructor" must not resolve through Object.prototype.
function nullProto<T>(pairs: Iterable<readonly [string, T]>): Record<string, T> {
  const out: Record<string, T> = Object.create(null);
  return Object.assign(out, Object.fromEntries(pairs));
}

// The page hosts check one app with the same toAppStrings(); an app without valid entries stays as {}.
const appStrings = (src: Record<string, unknown>): AppStrings =>
  toAppStrings(src) ?? nullProto([]);

export function sanitizeAchievements(raw: unknown): AchievementsPayload | null {
  const file = achievementsFileSchema.safeParse(raw).data;
  if (!file) {
    return null;
  }
  const apps = pipe(
    D.toPairs(file.apps),
    A.filterMap(([appid, src]) =>
      APP_ID.test(appid) && G.isObject(src) ? O.Some([appid, src] as const) : O.None
    ),
    A.take(ACH_MAX_APPS),
    A.map(([appid, src]) => [appid, appStrings(src)] as const)
  );
  return {
    stamp: O.toNullable(O.map(stampSchema.safeParse(file.stamp).data, String)),
    apps: nullProto(apps),
  };
}

// Rewrites achievement records in Steam's own objects in place, remembering the originals for revert.
export function createTextPatcher(data: Map<string, AppStrings>) {
  const has = (appid: unknown): boolean =>
    G.isNotNullable(appid) && data.has(String(appid));
  const lookup: AchLookup = (appid, id) =>
    G.isNullable(id) ? undefined : data.get(String(appid))?.[String(id)];

  const textKeys = (rec: Record<string, unknown>) => ({
    nameKey: 'strName' in rec ? 'strName' : 'name',
    descKey: 'strDescription' in rec ? 'strDescription' : 'desc',
  });
  const patchRecord = (
    appid: unknown,
    rec: Record<string, unknown>,
    keyHint: string | undefined,
    revert: boolean
  ): void => {
    const { nameKey, descKey } = textKeys(rec);
    const orig = rec[ACH_ORIG];
    if (revert) {
      if (G.isObject(orig)) {
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
    if (depth > 6) {
      return;
    }
    if (G.isArray(node)) {
      for (const x of node) {
        walk(appid, x, revert, depth + 1);
      }
      return;
    }
    if (!G.isObject(node)) {
      return;
    }
    if (G.isString(node.strName) || G.isString(node.strDescription)) {
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
  // A deep copy with Steam's own text back in every record walk() translated.
  const copyOriginal = (node: unknown, depth = 0): unknown => {
    if (depth > 6) {
      return node;
    }
    if (G.isArray(node)) {
      return A.map(node, (x) => copyOriginal(x, depth + 1));
    }
    if (!G.isObject(node)) {
      return node;
    }
    const out = D.map(node, (x) => copyOriginal(x, depth + 1));
    const orig = node[ACH_ORIG];
    if (G.isObject(orig)) {
      const { nameKey, descKey } = textKeys(node);
      out[nameKey] = orig.n;
      out[descKey] = orig.d;
    }
    return out;
  };
  const copyTranslated = (appid: unknown, node: unknown): unknown => {
    const out = copyOriginal(node);
    walk(appid, out, false, 0);
    return out;
  };

  return { has, lookup, walk, copyOriginal, copyTranslated };
}
