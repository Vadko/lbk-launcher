/**
 * Read a UserGameStatsSchema_<appid>.bin schema file and pull out localized
 * achievement strings keyed by their internal achievement ID.
 *
 * Schema layout (after binarykvparser does its thing):
 *   { [appid]: {
 *     stats: {
 *       [i]: {
 *         type: 'achievements' | ...,
 *         bits: {
 *           [j]: {
 *             name: 'ACH_INTERNAL_ID',
 *             display: {
 *               name: { english: '...', ukrainian: '...', ... },
 *               desc: { english: '...', ukrainian: '...', ... },
 *             }
 *           }
 *         }
 *       }
 *     }
 *   } }
 *
 * Reference: gibbed/SteamAchievementManager (SAM.Game/Manager.cs).
 */

import * as fs from 'node:fs';
import { parse as parseBinaryKv } from 'binarykvparser';

interface AchievementTranslationMap {
  [strID: string]: { strName: string; strDescription: string };
}

/**
 * Pick the localized string preferring the target language, then English, then
 * any other available language as a last resort. Returns null if the slot is
 * missing or not a string container.
 */
function pickLocalized(slot: unknown, preferredLang: string): string | null {
  if (typeof slot === 'string') return slot;
  if (!slot || typeof slot !== 'object') return null;
  const map = slot as Record<string, unknown>;
  const pref = map[preferredLang];
  if (typeof pref === 'string' && pref) return pref;
  const en = map.english;
  if (typeof en === 'string' && en) return en;
  for (const v of Object.values(map)) {
    if (typeof v === 'string' && v) return v;
  }
  return null;
}

function asObject(v: unknown): Record<string, unknown> | null {
  return v && typeof v === 'object' ? (v as Record<string, unknown>) : null;
}

/**
 * Parse `bin` (UserGameStatsSchema content) and extract the `{ strID →
 * { strName, strDescription } }` map for the given preferred language.
 *
 * Returns an empty object on any structural mismatch so callers can rely on
 * `Object.keys(...).length` as a "do we have anything to inject?" signal
 * without try/catch noise.
 */
function extractAchievementTranslations(
  bin: Buffer,
  preferredLang = 'ukrainian'
): AchievementTranslationMap {
  let parsed: unknown;
  try {
    parsed = parseBinaryKv(bin);
  } catch (error) {
    console.warn('[AchievementTranslations] Failed to parse schema:', error);
    return {};
  }

  const root = asObject(parsed);
  if (!root) return {};

  // The schema is keyed by appid at the top level; there's usually exactly one.
  // We don't filter by `stat.type` because Steam uses several values (`Achievements`,
  // `GroupAchievements`, sometimes empty) — any stat that carries a `bits` container
  // with per-bit `display` strings is what we want.
  const result: AchievementTranslationMap = {};
  for (const appNode of Object.values(root)) {
    const stats = asObject(asObject(appNode)?.stats);
    if (!stats) continue;

    for (const stat of Object.values(stats)) {
      const bits = asObject(asObject(stat)?.bits);
      if (!bits) continue;

      for (const bit of Object.values(bits)) {
        const bitObj = asObject(bit);
        if (!bitObj) continue;
        const strID = typeof bitObj.name === 'string' ? bitObj.name : null;
        if (!strID) continue;
        const display = asObject(bitObj.display);
        if (!display) continue;
        const strName = pickLocalized(display.name, preferredLang);
        const strDescription = pickLocalized(display.desc, preferredLang);
        if (strName === null && strDescription === null) continue;
        result[strID] = {
          strName: strName ?? '',
          strDescription: strDescription ?? '',
        };
      }
    }
  }

  // Diagnostic: when extraction yields nothing despite a parseable file, dump a
  // shallow picture of what the schema actually looks like so we can adjust.
  if (Object.keys(result).length === 0) {
    const summarize = (v: unknown, depth = 0): unknown => {
      if (depth > 2 || v === null || v === undefined) return v;
      if (typeof v !== 'object') return typeof v;
      const obj = v as Record<string, unknown>;
      const keys = Object.keys(obj).slice(0, 8);
      const out: Record<string, unknown> = {};
      for (const k of keys) out[k] = summarize(obj[k], depth + 1);
      if (Object.keys(obj).length > keys.length) out.__more = Object.keys(obj).length;
      return out;
    };
    console.warn(
      '[AchievementTranslations] No translations extracted. Schema shape:',
      JSON.stringify(summarize(root), null, 2)
    );
  }

  return result;
}

/**
 * Convenience wrapper: read the schema file at `path` and extract translations.
 */
export function extractAchievementTranslationsFromFile(
  schemaPath: string,
  preferredLang = 'ukrainian'
): AchievementTranslationMap {
  if (!fs.existsSync(schemaPath)) return {};
  const buf = fs.readFileSync(schemaPath);
  return extractAchievementTranslations(buf, preferredLang);
}
