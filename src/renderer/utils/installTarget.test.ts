import { describe, expect, it } from 'vitest';
import type { GamePath, InstallationInfo } from '@/shared/types';
import { copyKey, defaultCopyKey, installTarget } from './installTarget';

const BOTTLE = '/Users/me/Library/Application Support/CrossOver/Bottles/Steam';

const native: GamePath = { platform: 'steam', path: '/Steam/common/Game', exists: true };
const bottled: GamePath = {
  platform: 'steam',
  path: `${BOTTLE}/drive_c/Program Files (x86)/Steam/steamapps/common/Game`,
  exists: true,
  wine: { launcher: 'crossover', prefix: BOTTLE, label: 'Steam' },
};
const missingGog: GamePath = { platform: 'gog', path: '', exists: false };
const copies = [native, bottled, missingGog];

const record = (gamePath: string) => ({ gamePath }) as InstallationInfo;

describe('copyKey', () => {
  it.each([
    ['a native copy', native, 'steam'],
    ['a copy in a bottle', bottled, `steam@${BOTTLE}`],
  ])('%s', (_label, copy, key) => {
    expect(copyKey(copy)).toBe(key);
  });
});

describe('installTarget', () => {
  it.each([
    ['auto', 'auto', { platform: 'auto', winePrefix: undefined, copy: native }],
    ['the native copy', 'steam', { platform: 'steam', winePrefix: null, copy: native }],
    [
      'the bottle copy',
      `steam@${BOTTLE}`,
      { platform: 'steam', winePrefix: BOTTLE, copy: bottled },
    ],
    ['a store not found', 'gog', { platform: 'gog', winePrefix: null, copy: missingGog }],
    [
      'a stale key',
      'steam@/gone',
      { platform: 'auto', winePrefix: undefined, copy: native },
    ],
  ])('%s', (_label, selected, target) => {
    expect(installTarget(selected, copies)).toEqual(target);
  });
});

describe('defaultCopyKey', () => {
  it.each([
    ['a new install', undefined, 'auto'],
    ['a reinstall into the bottle', record(bottled.path), `steam@${BOTTLE}`],
    ['a reinstall into the native copy', record(native.path), 'steam'],
    ['a record whose folder moved', record('/old/Game'), 'steam'],
  ])('%s', (_label, info, key) => {
    expect(defaultCopyKey(copies, info)).toBe(key);
  });
});
