import { describe, expect, it } from 'vitest';
import {
  isSteamAccountId,
  isSteamId64,
  steam3ToSteam64,
  steam64ToSteam3,
} from './steam-id';

describe('isSteamAccountId', () => {
  it.each([
    ['a real account', '126948360', true],
    ['account 1', '1', true],
    ['the largest 32-bit account', '4294967295', true],
    ['the anonymous account 0', '0', false],
    ['a zero-padded 0', '000', false],
    ['past 32 bits', '4294967296', false],
    ['a negative id', '-1', false],
    ['a non-numeric folder', 'anonymous', false],
    ['an empty name', '', false],
  ])('%s', (_, id, expected) => {
    expect(isSteamAccountId(id)).toBe(expected);
  });
});

describe('isSteamId64', () => {
  it.each([
    ['a real account', '76561198087214088', true],
    ['account 1', '76561197960265729', true],
    ['the base SteamID64 (account 0)', '76561197960265728', false],
    ['below the base', '76561197960265727', false],
    ['past the 32-bit account range', '76561202255233024', false],
    ['a Steam3 id', '126948360', false],
    ['a non-numeric value', 'undefined', false],
    ['an empty value', '', false],
  ])('%s', (_, id, expected) => {
    expect(isSteamId64(id)).toBe(expected);
  });
});

describe('conversion', () => {
  it.each([
    ['126948360', '76561198087214088'],
    ['1', '76561197960265729'],
  ])('Steam3 %s is SteamID64 %s and back', (steam3, steam64) => {
    expect(steam3ToSteam64(steam3)).toBe(steam64);
    expect(steam64ToSteam3(steam64)).toBe(steam3);
  });
});
