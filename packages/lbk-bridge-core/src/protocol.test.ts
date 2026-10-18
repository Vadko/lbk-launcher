import { describe, expect, it } from 'vitest';
import {
  bridgeConfigSchema,
  challengeFrameSchema,
  hmacHex,
  pingFrameSchema,
  requestFrameSchema,
  safeEqual,
} from './protocol';

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

describe('frames', () => {
  it('ignores requests without an integer id or a string op', () => {
    expect(requestFrameSchema.safeParse({ t: 'req', id: 1, op: 'ping' }).success).toBe(
      true
    );
    expect(pingFrameSchema.safeParse({ t: 'ping' }).success).toBe(true);
    expect(
      challengeFrameSchema.safeParse({ t: 'challenge', sn: 'ab'.repeat(16) }).success
    ).toBe(true);
    expect(requestFrameSchema.safeParse({ t: 'req', id: 1.5, op: 'ping' }).success).toBe(
      false
    );
    expect(requestFrameSchema.safeParse({ t: 'req', id: 1, op: 2 }).success).toBe(false);
  });
});

describe('handshake helpers', () => {
  it('computes HMAC-SHA256 as hex (RFC 4231 case 2)', async () => {
    await expect(
      hmacHex(globalThis.crypto.subtle, '4a656665', 'what do ya want for nothing?')
    ).resolves.toBe('5bdcc146bf60754e6a042426089575c75a003f089d2739839dec58b964ec3843');
  });

  it('compares only equal-length strings', () => {
    expect(safeEqual('abc', 'abc')).toBe(true);
    expect(safeEqual('abc', 'abd')).toBe(false);
    expect(safeEqual('abc', 'ab')).toBe(false);
    expect(safeEqual('abc', undefined)).toBe(false);
  });
});
