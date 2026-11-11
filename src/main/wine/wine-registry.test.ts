import { describe, expect, it } from 'vitest';
import { readRegString } from './wine-registry';

const IHOR = String.fromCharCode(0x406, 0x433, 0x43e, 0x440);

const USER_REG = [
  'WINE REGISTRY Version 2',
  ';; All keys relative to REGISTRY\\\\User\\\\S-1-5-21-0-0-0-1000',
  '',
  '[Software\\\\Valve\\\\Steam] 1762866000',
  '#time=1dc52a3b1e2f0a0',
  '"SteamExe"="c:/program files (x86)/steam/steam.exe"',
  '"SteamPath"="c:/program files (x86)/steam"',
  '"Language"=dword:00000001',
  '',
  '[Software\\\\Valve\\\\Steam\\\\ActiveProcess] 1762866000',
  '"SteamPath"="wrong"',
  '',
  '[Software\\\\Wine\\\\Fonts] 1762866000',
  '"Path"="Z:\\\\Users\\\\\\x0406\\x0433\\x043e\\x0440"',
  '@="default"',
  '"Expand"=str(2):"%SystemRoot%"',
  '',
  '[Software\\\\\\x0406gor] 1762866000',
  '"Name"="cyrillic key"',
].join('\n');

// Each case is the value of one line, read back as Wine's parse_strW reads it
function decoded(raw: string): string | null {
  return readRegString(`[K] 1\n"V"="${raw}"`, 'K', 'V');
}

describe('a string value', () => {
  it.each([
    ['plain text', 'c:/program files', 'c:/program files'],
    ['an escaped backslash', 'C:\\\\Games', 'C:\\Games'],
    ['a Cyrillic UTF-16 escape', '\\x0406\\x0433\\x043e\\x0440', IHOR],
    ['as many hex digits as follow, four at most', '\\x41B', String.fromCharCode(0x41b)],
    ['a padded hex escape before a hex digit', '\\x0041B', 'AB'],
    ['a surrogate pair', '\\xd83c\\xdf0e', '\u{1F30E}'],
    ['an escaped quote', 'say \\"hi\\"', 'say "hi"'],
    ['a C escape', 'a\\tb\\nc', 'a\tb\nc'],
    ['an octal escape', 'a\\0b\\101', 'a\0bA'],
    ['an x with no digits', 'a\\xyz', 'axyz'],
    ['an unknown escape', 'a\\qb', 'aqb'],
    ['a value whose closing quote is escaped', 'open\\', null],
  ])('decodes %s', (_label, raw, value) => {
    expect(decoded(raw)).toBe(value);
  });
});

describe('readRegString', () => {
  it.each([
    [
      'the value of the key itself',
      'Software\\Valve\\Steam',
      'SteamPath',
      'c:/program files (x86)/steam',
    ],
    [
      'a name in another case',
      'software\\valve\\steam',
      'steampath',
      'c:/program files (x86)/steam',
    ],
    ['a decoded value', 'Software\\Wine\\Fonts', 'Path', `Z:\\Users\\${IHOR}`],
    ['the default value', 'Software\\Wine\\Fonts', '', 'default'],
    ['an expandable string', 'Software\\Wine\\Fonts', 'Expand', '%SystemRoot%'],
    [
      'a key whose name is escaped',
      `Software\\${IHOR.slice(0, 1)}gor`,
      'Name',
      'cyrillic key',
    ],
    ['a dword, which is no string', 'Software\\Valve\\Steam', 'Language', null],
    ['a missing name', 'Software\\Valve\\Steam', 'Missing', null],
    ['a missing key', 'Software\\Valve\\Other', 'SteamPath', null],
  ])('reads %s', (_label, key, name, value) => {
    expect(readRegString(USER_REG, key, name)).toBe(value);
  });
});
