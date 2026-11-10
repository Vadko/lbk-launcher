import { describe, expect, it } from 'vitest';
import { decodeRegString, readRegString } from './wine-registry';

const IHOR = String.fromCharCode(0x406, 0x433, 0x43e, 0x440);

const USER_REG = [
  'WINE REGISTRY Version 2',
  ';; All keys relative to REGISTRY\\\\User\\\\S-1-5-21-0-0-0-1000',
  '',
  '[Software\\\\Valve\\\\Steam] 1762866000',
  '#time=1dc52a3b1e2f0a0',
  '"SteamExe"="c:/program files (x86)/steam/steam.exe"',
  '"SteamPath"="c:/program files (x86)/steam"',
  '',
  '[Software\\\\Valve\\\\Steam\\\\ActiveProcess] 1762866000',
  '"SteamPath"="wrong"',
  '',
  '[Software\\\\Wine\\\\Fonts] 1762866000',
  '"Path"="Z:\\\\Users\\\\\\x0406\\x0433\\x043e\\x0440"',
].join('\n');

describe('decodeRegString', () => {
  it.each([
    ['plain text', 'c:/program files', 'c:/program files'],
    ['an escaped backslash', 'C:\\\\Games', 'C:\\Games'],
    ['a Cyrillic UTF-16 escape', '\\x0406\\x0433\\x043e\\x0440', IHOR],
    ['a surrogate pair', '\\xd83c\\xdf0e', '\u{1F30E}'],
    ['an escaped quote', 'say \\"hi\\"', 'say "hi"'],
    ['a trailing backslash', 'end\\', 'end\\'],
  ])('%s', (_label, raw, decoded) => {
    expect(decodeRegString(raw)).toBe(decoded);
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
    ['a missing name', 'Software\\Valve\\Steam', 'Language', null],
    ['a missing key', 'Software\\Valve\\Other', 'SteamPath', null],
  ])('%s', (_label, key, name, value) => {
    expect(readRegString(USER_REG, key, name)).toBe(value);
  });
});
