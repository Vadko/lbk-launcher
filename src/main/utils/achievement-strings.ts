import { G } from '@mobily/ts-belt';
import { type KvObject, parse as parseBinaryKv } from 'binarykvparser';
import { z } from 'zod';

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

const kvString = z.string().optional().catch(undefined);

// Old schemas store display.name as a bare string instead of a {lang: str} map.
const langText = z
  .preprocess(
    (value) => (typeof value === 'string' ? { english: value } : value),
    z.object({ english: kvString, ukrainian: kvString })
  )
  .optional()
  .catch(undefined);

// Objects keyed 0..n-1 come back as arrays; a malformed entry is skipped, not fatal.
function kvList<T extends z.ZodType>(item: T) {
  return z
    .union([z.array(z.unknown()), z.record(z.string(), z.unknown())])
    .transform((list) =>
      Object.values(list).flatMap((entry) => {
        const parsed = item.safeParse(entry);
        return parsed.success ? [parsed.data] : [];
      })
    )
    .catch([]);
}

const bitSchema = z.object({
  name: z.string().min(1),
  display: z.object({ name: langText, desc: langText }),
});

const appSchema = z.object({
  stats: kvList(z.object({ bits: kvList(bitSchema) })),
});

type LangText = z.infer<typeof langText>;

const utf8 = new TextEncoder();

// encodeInto never splits a code point, so `read` is a safe cut.
function truncateUtf8(value: string, maxBytes: number): string {
  const { read } = utf8.encodeInto(value, new Uint8Array(maxBytes));
  return value.slice(0, read);
}

// LBK archives write Ukrainian into the `english` key, so only Cyrillic there counts as a translation.
function pickTranslation(langs: LangText): string | undefined {
  const ukrainian = langs?.ukrainian?.trim();
  if (ukrainian) {
    return truncateUtf8(ukrainian, MAX_STRING_BYTES);
  }
  const english = langs?.english?.trim();
  if (english && CYRILLIC_WORD.test(english)) {
    return truncateUtf8(english, MAX_STRING_BYTES);
  }
  return undefined;
}

function schemaAchievements(app: unknown): z.infer<typeof bitSchema>[] {
  return appSchema.safeParse(app).data?.stats.flatMap((stat) => stat.bits) ?? [];
}

function findAppRoot(root: KvObject): { key: string; app: unknown } | null {
  const entry = Object.entries(root).find(([, value]) => G.isObject(value));
  return entry ? { key: entry[0], app: entry[1] } : null;
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
  for (const { name: apiName, display } of schemaAchievements(found.app)) {
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
      const value = field?.english?.trim();
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
