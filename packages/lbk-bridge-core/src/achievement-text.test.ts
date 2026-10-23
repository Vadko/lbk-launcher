import { describe, expect, it } from 'vitest';
import { sanitizeAchievements } from './achievement-text';

describe('sanitizeAchievements', () => {
  it('rejects a file without version 1 and an apps object', () => {
    expect(sanitizeAchievements(null)).toBeNull();
    expect(sanitizeAchievements({ v: 2, apps: {} })).toBeNull();
    expect(sanitizeAchievements({ v: 1 })).toBeNull();
  });

  it('keeps only bounded strings under numeric app ids', () => {
    const payload = sanitizeAchievements({
      v: 1,
      stamp: 42,
      apps: {
        '10': {
          ACH_A: { name: 'First', desc: 'Description' },
          ACH_B: { name: '', desc: 'x'.repeat(4097) },
          ACH_C: { name: 'y'.repeat(2048) },
          ['z'.repeat(257)]: { name: 'too long key' },
        },
        app: { ACH_A: { name: 'not numeric' } },
        '20': 'not an object',
      },
    });
    expect(payload?.stamp).toBe('42');
    expect(Object.keys(payload?.apps ?? {})).toEqual(['10']);
    expect({ ...payload?.apps['10'] }).toEqual({
      ACH_A: { name: 'First', desc: 'Description' },
      ACH_C: { name: 'y'.repeat(2048) },
    });
  });

  it('caps the number of apps', () => {
    const apps = Object.fromEntries(
      Array.from({ length: 5001 }, (_, i) => [String(i + 1), {}])
    );
    expect(Object.keys(sanitizeAchievements({ v: 1, apps })?.apps ?? {})).toHaveLength(
      5000
    );
  });
});
