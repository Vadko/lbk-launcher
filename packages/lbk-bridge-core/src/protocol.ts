import { G } from '@mobily/ts-belt';
import * as z from 'zod/mini';
import { BRIDGE_PROTOCOL } from './contract';

const hex = (length: number) =>
  z.string().check(z.regex(new RegExp(`^[0-9a-f]{${length}}$`)));

export const bridgeConfigSchema = z.object({
  v: z.literal(BRIDGE_PROTOCOL),
  port: z.int().check(z.gte(1024), z.lte(65535)),
  secret: hex(64),
});

export type BridgeConfig = z.infer<typeof bridgeConfigSchema>;

const challengeFrameSchema = z.object({
  t: z.literal('challenge'),
  sn: hex(32),
  sp: z.optional(z.unknown()),
});

const readyFrameSchema = z.object({ t: z.literal('ready') });

const pingFrameSchema = z.object({
  t: z.literal('ping'),
  id: z.optional(z.unknown()),
});

const requestFrameSchema = z.object({
  t: z.literal('req'),
  id: z.int(),
  op: z.string(),
  args: z.optional(z.unknown()),
});

export const serverFrameSchema = z.union([
  challengeFrameSchema,
  readyFrameSchema,
  pingFrameSchema,
  requestFrameSchema,
]);

export type RequestFrame = z.infer<typeof requestFrameSchema>;

export type PluginFrame =
  | {
      t: 'hello';
      v: typeof BRIDGE_PROTOCOL;
      plugin: string;
      pv: string;
      host: string;
      ops: string[];
      cn: string;
    }
  | { t: 'auth'; cp: string }
  | { t: 'pong'; id: unknown }
  | { t: 'res'; id: number; ok: true; value: unknown }
  | { t: 'res'; id: number; ok: false; error: string };

const encoder = new TextEncoder();

export const toHex = (bytes: ArrayBuffer | Uint8Array): string =>
  Array.from(new Uint8Array(bytes), (b) => b.toString(16).padStart(2, '0')).join('');

const fromHex = (hexText: string): Uint8Array<ArrayBuffer> =>
  Uint8Array.from(hexText.match(/../g) ?? [], (h) => parseInt(h, 16));

// The handshake proofs are HMAC-SHA256 over "server|cn|sn" and "client|sn|cn" with the bridge.json secret.
export async function hmacHex(
  subtle: SubtleCrypto,
  secretHex: string,
  message: string
): Promise<string> {
  const key = await subtle.importKey(
    'raw',
    fromHex(secretHex),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  return toHex(await subtle.sign('HMAC', key, encoder.encode(message)));
}

export function safeEqual(a: unknown, b: unknown): boolean {
  if (!G.isString(a) || !G.isString(b) || a.length !== b.length) {
    return false;
  }
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}
