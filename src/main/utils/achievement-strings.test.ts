import { afterEach, describe, expect, it, vi } from 'vitest';
import { extractAchievementStrings } from './achievement-strings';

const END = Buffer.from([0x08]);
const cstr = (s: string) => Buffer.concat([Buffer.from(s, 'utf8'), Buffer.from([0])]);
const obj = (key: string, ...kids: Buffer[]) =>
  Buffer.concat([Buffer.from([0x00]), cstr(key), ...kids, END]);
const str = (key: string, v: string) =>
  Buffer.concat([Buffer.from([0x01]), cstr(key), cstr(v)]);
const int32 = (key: string, v: number) => {
  const b = Buffer.alloc(4);
  b.writeInt32LE(v);
  return Buffer.concat([Buffer.from([0x02]), cstr(key), b]);
};
const langs = (key: string, map: Record<string, string>) =>
  obj(
    key,
    ...Object.entries(map).map(([lang, text]) => str(lang, text)),
    str('token', 'T')
  );

interface Ach {
  api?: string;
  name?: Record<string, string>;
  desc?: Record<string, string>;
  hidden?: Buffer;
}

const bit = (index: number, a: Ach) =>
  obj(
    String(index),
    ...(a.api === undefined ? [] : [str('name', a.api)]),
    obj(
      'display',
      ...(a.name ? [langs('name', a.name)] : []),
      ...(a.desc ? [langs('desc', a.desc)] : []),
      a.hidden ?? int32('hidden', 0),
      str('icon', 'a.jpg')
    ),
    int32('bit', index)
  );

const schema = (appKey: string, achs: Ach[], version: Buffer = int32('version', 25)) =>
  Buffer.concat([
    obj(
      appKey,
      str('gamename', 'Test'),
      version,
      obj(
        'stats',
        obj('1', int32('type', 4), obj('bits', ...achs.map((a, i) => bit(i, a)))),
        obj('2', int32('type', 1), str('name', 'kills'))
      )
    ),
    END,
  ]);

const FILE = 'UserGameStatsSchema_1623730.bin';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('extractAchievementStrings', () => {
  it('prefers the ukrainian key over Cyrillic in english', () => {
    const buf = schema('1623730', [
      {
        api: 'A',
        name: { english: 'Авторитет', ukrainian: 'Володар пагорба' },
        desc: { english: 'Defeat Zoe', ukrainian: 'Здолайте Зої' },
      },
    ]);
    expect(extractAchievementStrings(buf, FILE)).toEqual({
      appId: 1623730,
      strings: { A: { name: 'Володар пагорба', desc: 'Здолайте Зої' } },
    });
  });

  it('falls back to Cyrillic english, also when ukrainian is blank', () => {
    const buf = schema('1623730', [
      {
        api: 'A',
        name: { english: 'Авторитет Косогору' },
        desc: { english: 'Ви здолали Зої' },
      },
      { api: 'B', name: { english: 'Кров', ukrainian: '   ' } },
    ]);
    expect(extractAchievementStrings(buf, FILE).strings).toEqual({
      A: { name: 'Авторитет Косогору', desc: 'Ви здолали Зої' },
      B: { name: 'Кров' },
    });
  });

  it('picks name and desc independently and skips untranslated entries', () => {
    const buf = schema('1623730', [
      {
        api: 'ONLY_DESC',
        name: { english: 'Hillside' },
        desc: { english: 'Здолайте Зої' },
      },
      { api: 'ENGLISH', name: { english: 'Hillside' }, desc: { english: 'Defeat Zoe' } },
      { api: 'RUSSIAN_ONLY', name: { english: 'Blood', russian: 'Кровь' } },
    ]);
    expect(extractAchievementStrings(buf, FILE).strings).toEqual({
      ONLY_DESC: { desc: 'Здолайте Зої' },
    });
  });

  it('ignores single Cyrillic homoglyphs in official English text', () => {
    const buf = schema('43160', [{ api: 'A', name: { english: 'Test Сomplete' } }]);
    expect(
      extractAchievementStrings(buf, 'UserGameStatsSchema_43160.bin').strings
    ).toEqual({});
  });

  it('copies no token, icon or hidden fields', () => {
    const buf = schema(
      '1623730',
      [{ api: 'A', name: { english: 'Кров' }, hidden: str('hidden', '0') }],
      str('version', '5')
    );
    expect(extractAchievementStrings(buf, FILE).strings.A).toStrictEqual({
      name: 'Кров',
    });
  });

  it('skips bits without an API name', () => {
    const buf = schema('1623730', [{ name: { english: 'Кров' } }]);
    expect(extractAchievementStrings(buf, FILE).strings).toEqual({});
  });

  it('accepts a bare string display name from old schemas', () => {
    const display = obj('display', str('name', 'Кров'));
    const buf = Buffer.concat([
      obj('10', obj('stats', obj('1', obj('bits', obj('0', str('name', 'A'), display))))),
      END,
    ]);
    expect(extractAchievementStrings(buf, 'UserGameStatsSchema_10.bin').strings).toEqual({
      A: { name: 'Кров' },
    });
  });

  it('trims and caps strings at 1 KB without splitting a character', () => {
    const long = 'ї'.repeat(600);
    const buf = schema('1623730', [{ api: 'A', name: { ukrainian: `  ${long}  ` } }]);
    const name = extractAchievementStrings(buf, FILE).strings.A.name ?? '';
    // Node 26's encodeInto may stop a code point early; Electron's Node 24 fills to the byte.
    expect(Buffer.byteLength(name, 'utf8')).toBeLessThanOrEqual(1024);
    expect(name.length).toBeGreaterThanOrEqual(511);
    expect(name).toBe('ї'.repeat(name.length));
  });

  it('trusts the root key over the file name and warns', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const buf = schema('2623190', [{ api: 'A', name: { english: 'Кров' } }]);
    expect(extractAchievementStrings(buf, FILE).appId).toBe(2623190);
    expect(warn).toHaveBeenCalledOnce();
  });

  it('uses the file name when the root key is not an app id', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const buf = schema('game', [{ api: 'A', name: { english: 'Кров' } }]);
    expect(extractAchievementStrings(buf, `/x/y/${FILE}`).appId).toBe(1623730);
  });

  it('throws when no app id can be resolved', () => {
    const buf = schema('game', []);
    expect(() => extractAchievementStrings(buf, 'schema.bin')).toThrow();
  });
});
