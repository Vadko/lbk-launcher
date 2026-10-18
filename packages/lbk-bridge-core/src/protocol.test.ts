import { describe, expect, it } from 'vitest';
import { bridgeConfigSchema, safeEqual } from './protocol';

describe('bridge.json', () => {
  const valid = { v: 1, port: 50000, secret: 'ab'.repeat(32) };

  it('accepts what LBK writes and rejects anything else', () => {
    expect(bridgeConfigSchema.safeParse(valid).data).toEqual(valid);
    for (const bad of [
      null,
      { ...valid, v: 2 },
      { ...valid, port: 80 },
      { ...valid, port: 65536 },
      { ...valid, port: 5000.5 },
      { ...valid, secret: 'AB'.repeat(32) },
      { ...valid, secret: 'ab' },
    ]) {
      expect(bridgeConfigSchema.safeParse(bad).success).toBe(false);
    }
  });
});

describe('safeEqual', () => {
  it('compares only equal-length strings', () => {
    expect(safeEqual('abc', 'abc')).toBe(true);
    expect(safeEqual('abc', 'abd')).toBe(false);
    expect(safeEqual('abc', 'ab')).toBe(false);
    expect(safeEqual('abc', undefined)).toBe(false);
  });
});
