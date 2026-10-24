import { hmacHex } from '@lbk/bridge-core/protocol';
import { describe, expect, it } from 'vitest';
import {
  computeServerProof,
  isAllowedUpgrade,
  parseHello,
  verifyClientProof,
} from '@/main/steam-bridge-server/protocol';

const SECRET = 'ab'.repeat(32);
const CN = '0123456789abcdef0123456789abcdef';
const SN = 'fedcba9876543210fedcba9876543210';
const ORIGIN = 'https://steamloopback.host';
const helloFrame = (extra: Record<string, unknown> = {}) => ({
  t: 'hello',
  v: 1,
  plugin: 'lbk-bridge',
  pv: '1.1.0',
  host: 'millennium',
  ops: [],
  cn: CN,
  ...extra,
});

const pluginHmac = (secretHex: string, message: string) =>
  hmacHex(crypto.subtle, secretHex, message);

describe('handshake proofs', () => {
  it('server proof equals the plugin-side HMAC of "server|cn|sn"', async () => {
    expect(computeServerProof(SECRET, CN, SN)).toBe(
      await pluginHmac(SECRET, `server|${CN}|${SN}`)
    );
  });

  it('accepts the plugin-side client proof and rejects anything else', async () => {
    const cp = await pluginHmac(SECRET, `client|${SN}|${CN}`);
    expect(verifyClientProof(SECRET, SN, CN, cp)).toBe(true);
    expect(
      verifyClientProof(
        SECRET,
        SN,
        CN,
        cp.replace(/.$/, (c) => (c === '0' ? '1' : '0'))
      )
    ).toBe(false);
    expect(verifyClientProof(SECRET, CN, SN, cp)).toBe(false);
    expect(verifyClientProof(SECRET, SN, CN, cp.slice(0, 62))).toBe(false);
    expect(verifyClientProof(SECRET, SN, CN, 'zz'.repeat(32))).toBe(false);
    expect(verifyClientProof(SECRET, SN, CN, computeServerProof(SECRET, CN, SN))).toBe(
      false
    );
  });
});

describe('isAllowedUpgrade', () => {
  it('accepts only the Steam origin on the exact loopback host', () => {
    expect(isAllowedUpgrade({ origin: ORIGIN, host: '127.0.0.1:4567' }, 4567)).toBe(true);
  });

  it.each([
    ['foreign origin', { origin: 'https://example.com', host: '127.0.0.1:4567' }],
    ['missing origin', { host: '127.0.0.1:4567' }],
    ['localhost host', { origin: ORIGIN, host: 'localhost:4567' }],
    ['wrong port', { origin: ORIGIN, host: '127.0.0.1:4568' }],
    ['missing host', { origin: ORIGIN }],
    ['http origin', { origin: 'http://steamloopback.host', host: '127.0.0.1:4567' }],
  ])('rejects %s', (_label, headers) => {
    expect(isAllowedUpgrade(headers, 4567)).toBe(false);
  });
});

describe('parseHello', () => {
  it.each(['millennium', 'decky'])('accepts the %s host', (host) => {
    expect(parseHello(helloFrame({ host }))?.host).toBe(host);
  });

  it('rejects a missing or unknown host', () => {
    expect(parseHello(helloFrame({ host: undefined }))).toBeNull();
    expect(parseHello(helloFrame({ host: 'browser' }))).toBeNull();
    expect(parseHello(helloFrame({ host: 1 }))).toBeNull();
  });
});
