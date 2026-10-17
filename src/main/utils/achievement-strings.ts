import { G } from '@mobily/ts-belt';
import { type KvObject, type KvValue, parse as parseBinaryKv } from 'binarykvparser';

interface AchievementStringEntry {
  name?: string;
  desc?: string;
}

export interface ExtractedAchievementStrings {
  appId: number;
  strings: Record<string, AchievementStringEntry>;
}

// Two letters in a row: official English strings use single Cyrillic homoglyphs (Metro's «Сomplete»).
const CYRILLIC_WORD = /[\u0400-\u04FF]{2,}/;
const SCHEMA_FILE_NAME = /UserGameStatsSchema_(\d+)\.bin$/i;
const MAX_STRING_BYTES = 1024;
const OUR_STRINGS_MIN_SHARE = 0.25;

const asObject = (value: KvValue | undefined): KvObject | null =>
  G.isObject(value) ? value : null;

const childrenOf = (value: KvValue | undefined): KvValue[] =>
  typeof value === 'object' ? Object.values(value) : [];

const asString = (value: KvValue | undefined): string | null =>
  G.isString(value) ? value : null;

const utf8 = new TextEncoder();

// encodeInto never splits a code point, so `read` is a safe cut.
function truncateUtf8(value: string, maxBytes: number): string {
  const { read } = utf8.encodeInto(value, new Uint8Array(maxBytes));
  return value.slice(0, read);
}

// Old schemas store display.name as a bare string instead of a {lang: str} map.
function languageMap(field: KvValue | undefined): KvObject | null {
  if (typeof field === 'string') {
    return { english: field };
  }
  return asObject(field);
}

// LBK archives write Ukrainian into the `english` key, so only Cyrillic there counts as a translation.
function pickTranslation(field: KvValue | undefined): string | undefined {
  const langs = languageMap(field);
  if (!langs) {
    return undefined;
  }
  const ukrainian = asString(langs.ukrainian)?.trim();
  if (ukrainian) {
    return truncateUtf8(ukrainian, MAX_STRING_BYTES);
  }
  const english = asString(langs.english)?.trim();
  if (english && CYRILLIC_WORD.test(english)) {
    return truncateUtf8(english, MAX_STRING_BYTES);
  }
  return undefined;
}

interface SchemaAchievement {
  apiName: string;
  display: KvObject;
}

function* schemaAchievements(app: KvObject): Generator<SchemaAchievement> {
  for (const stat of childrenOf(app.stats)) {
    for (const bit of childrenOf(asObject(stat)?.bits)) {
      const bitObj = asObject(bit);
      const apiName = asString(bitObj?.name);
      const display = asObject(bitObj?.display);
      if (apiName && display) {
        yield { apiName, display };
      }
    }
  }
}

function findAppRoot(root: KvObject): { key: string; app: KvObject } | null {
  for (const [key, value] of Object.entries(root)) {
    const app = asObject(value);
    if (app) {
      return { key, app };
    }
  }
  return null;
}

function resolveAppId(rootKey: string, fileName: string): number {
  const fromKey = /^\d+$/.test(rootKey) ? Number(rootKey) : null;
  const fileMatch = SCHEMA_FILE_NAME.exec(fileName);
  const fromFile = fileMatch ? Number(fileMatch[1]) : null;

  if (fromKey !== null && fromKey > 0) {
    if (fromFile !== null && fromFile !== fromKey) {
      console.warn(
        `[Achievements] ${fileName}: root key ${fromKey} does not match file name, using root key`
      );
    }
    return fromKey;
  }
  if (fromFile !== null && fromFile > 0) {
    console.warn(
      `[Achievements] ${fileName}: root key "${rootKey}" is not an app id, using file name`
    );
    return fromFile;
  }
  throw new Error(`Cannot determine app id for ${fileName}`);
}

// Throws on a malformed schema and Error when no app id can be resolved.
export function extractAchievementStrings(
  buf: Buffer,
  fileName: string
): ExtractedAchievementStrings {
  const root = parseBinaryKv(buf);
  const found = findAppRoot(root);
  if (!found) {
    throw new Error(`No app section in ${fileName}`);
  }
  const appId = resolveAppId(found.key, fileName);

  const strings: Record<string, AchievementStringEntry> = Object.create(null);
  for (const { apiName, display } of schemaAchievements(found.app)) {
    if (apiName in strings) {
      continue;
    }
    const name = pickTranslation(display.name);
    const desc = pickTranslation(display.desc);
    if (name === undefined && desc === undefined) {
      continue;
    }
    const entry: AchievementStringEntry = {};
    if (name !== undefined) {
      entry.name = name;
    }
    if (desc !== undefined) {
      entry.desc = desc;
    }
    strings[apiName] = entry;
  }

  return { appId, strings };
}

// LBK puts Ukrainian into `english` for most achievements; a stray Cyrillic string in an official file must not count.
export function hasOurStrings(buf: Buffer): boolean {
  let root: KvObject;
  try {
    root = parseBinaryKv(buf);
  } catch {
    return false;
  }
  const found = findAppRoot(root);
  if (!found) {
    return false;
  }
  let english = 0;
  let cyrillic = 0;
  for (const { display } of schemaAchievements(found.app)) {
    for (const field of [display.name, display.desc]) {
      const value = asString(languageMap(field)?.english)?.trim();
      if (!value) {
        continue;
      }
      english++;
      if (CYRILLIC_WORD.test(value)) {
        cyrillic++;
      }
    }
  }
  return cyrillic > 0 && cyrillic >= english * OUR_STRINGS_MIN_SHARE;
}
