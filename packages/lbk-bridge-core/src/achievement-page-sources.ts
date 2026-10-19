import { G } from '@mobily/ts-belt';
import {
  achievementQueryAppId,
  mapRecords,
  QUERY_TEXT_FIELDS,
} from './achievement-query-cache';
import type { AchText, AppStrings } from './achievement-text';

// The same bounds sanitizeAchievements() applies to achievements.json, without zod.
const MAX_ID = 256;
const MAX_TEXT: Record<keyof AchText, number> = { name: 2048, desc: 4096 };

const boundedText = (value: unknown, max: number): string | undefined =>
  G.isString(value) && value.length > 0 && value.length <= max ? value : undefined;

// Strings for one app from a host, as untrusted as anything else the page holds.
export function toAppStrings(raw: unknown): AppStrings | undefined {
  if (!G.isObject(raw)) {
    return undefined;
  }
  // An api_name like "constructor" must not resolve through Object.prototype.
  const out: AppStrings = Object.create(null);
  let count = 0;
  for (const id of Object.keys(raw)) {
    const src = raw[id];
    if (id.length > MAX_ID || !G.isObject(src)) {
      continue;
    }
    const text: AchText = {};
    const name = boundedText(src.name, MAX_TEXT.name);
    const desc = boundedText(src.desc, MAX_TEXT.desc);
    if (name) {
      text.name = name;
    }
    if (desc) {
      text.desc = desc;
    }
    if (name || desc) {
      out[id] = text;
      count += 1;
    }
  }
  return count > 0 ? out : undefined;
}

// One app of achievements.json under the envelope sanitizeAchievements() checks; web pages get no zod and its global.
export function appStringsInFile(raw: unknown, appid: string): AppStrings | undefined {
  const apps: Record<string, unknown> =
    G.isObject(raw) && raw.v === 1 && G.isObject(raw.apps) ? raw.apps : {};
  return Object.hasOwn(apps, appid) ? toAppStrings(apps[appid]) : undefined;
}

const parseQueryData = (raw: unknown): unknown => {
  if (!G.isString(raw)) {
    return raw;
  }
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
};

// Steam's English text -> translation for one app, read from the dehydrated React Query state the SSR page ships.
export function buildSourceMap(
  queryData: unknown,
  appid: string,
  strings: AppStrings
): Map<string, string> {
  const state = parseQueryData(queryData);
  const queries = G.isObject(state) && G.isArray(state.queries) ? state.queries : [];
  const out = new Map<string, string>();
  const ambiguous = new Set<string>();
  const add = (source: string, text: string): void => {
    if (!source || ambiguous.has(source)) {
      return;
    }
    const known = out.get(source);
    if (known === undefined) {
      out.set(source, text);
    } else if (known !== text) {
      // One English string shown for two achievements cannot be told apart in the DOM.
      out.delete(source);
      ambiguous.add(source);
    }
  };
  for (const query of queries) {
    if (
      !G.isObject(query) ||
      !G.isObject(query.state) ||
      String(achievementQueryAppId(query.queryKey)) !== appid
    ) {
      continue;
    }
    mapRecords(query.state.data, (rec) => {
      const id = rec.api_name;
      const t = G.isString(id) && Object.hasOwn(strings, id) ? strings[id] : undefined;
      for (const [key, field] of QUERY_TEXT_FIELDS) {
        const english = rec[key];
        if (G.isString(english)) {
          // An untranslated field maps to itself, so text another achievement shares stays ambiguous.
          add(english.trim(), t?.[field] ?? english.trim());
        }
      }
      return rec;
    });
  }
  for (const [source, text] of out) {
    if (source === text) {
      out.delete(source);
    }
  }
  return out;
}
