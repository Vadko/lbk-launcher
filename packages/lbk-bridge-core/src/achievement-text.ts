import { A, D, G, O, pipe } from '@mobily/ts-belt';
import * as z from 'zod/mini';

const ACH_MAX_APPS = 5000;
const ACH_ORIG = '__lbkOrig';
const APP_ID = /^\d{1,10}$/;

export interface AchText {
  name?: string;
  desc?: string;
}

type AppStrings = Record<string, AchText>;

export interface AchievementsPayload {
  stamp: string | null;
  apps: Record<string, AppStrings>;
}

export type AchLookup = (appid: unknown, id: unknown) => AchText | undefined;

interface FieldMemory {
  orig: string;
  ours: Set<string>;
}

// Keeps Steam's text and every string written over it, so restoring never depends on the current translation.
export function createTextMemory() {
  const fields = new Map<string, FieldMemory>();
  // The text to show: the translation when there is one, otherwise Steam's own.
  const show = (
    appid: unknown,
    id: unknown,
    field: keyof AchText,
    current: string,
    text: string | undefined
  ): string => {
    const key = `${String(appid)}\u0000${String(id)}\u0000${field}`;
    const entry = fields.get(key);
    if (text === undefined) {
      return entry?.ours.has(current) ? entry.orig : current;
    }
    if (current === text) {
      return text;
    }
    if (!entry) {
      fields.set(key, { orig: current, ours: new Set([text]) });
    } else {
      if (!entry.ours.has(current)) {
        entry.orig = current;
      }
      entry.ours.add(text);
    }
    return text;
  };
  return { show };
}

// Parsed field by field, not with z.catch: the Decky build keeps its source comment, which fails bridge-artifacts.test.ts.
const boundedText = (max: number) => z.string().check(z.minLength(1), z.maxLength(max));
const nameSchema = boundedText(2048);
const descSchema = boundedText(4096);
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

const achEntry = ([api, raw]: readonly [string, unknown]) => {
  if (api.length > 256 || !G.isObject(raw)) {
    return O.None;
  }
  // A blank or oversized string drops only its own field.
  const text: AchText = D.filter(
    {
      name: nameSchema.safeParse(raw.name).data,
      desc: descSchema.safeParse(raw.desc).data,
    },
    G.isNotNullable
  );
  return text.name || text.desc ? O.Some([api, text] as const) : O.None;
};

const appStrings = (src: Record<string, unknown>): AppStrings =>
  nullProto(A.filterMap(D.toPairs(src), achEntry));

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
