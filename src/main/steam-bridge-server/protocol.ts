import { createHmac, timingSafeEqual } from 'node:crypto';
import {
  BRIDGE_HOSTS,
  BRIDGE_PLUGIN_NAME,
  BRIDGE_PROTOCOL,
} from '@lbk/bridge-core/contract';
import type { RawData, WebSocket } from 'ws';
import { z } from 'zod';

const ALLOWED_ORIGIN = 'https://steamloopback.host';
const HEX32 = /^[0-9a-f]{32}$/;
const HEX64 = /^[0-9a-f]{64}$/;

export const CloseCode = {
  protocol: 4002,
  auth: 4003,
  handshakeTimeout: 4004,
  replaced: 4009,
  shutdown: 4010,
  busy: 4011,
} as const;

type PluginBridgeErrorCode =
  | 'not-connected'
  | 'outdated'
  | 'disconnected'
  | 'timeout'
  | 'op-failed';

// Logs and callers see `plugin-<code>`, or the plugin's own error text for a failed op.
export class PluginBridgeError extends Error {
  constructor(
    readonly code: PluginBridgeErrorCode,
    message = `plugin-${code}`
  ) {
    super(message);
    this.name = 'PluginBridgeError';
  }
}

export function computeServerProof(secretHex: string, cn: string, sn: string): string {
  return createHmac('sha256', Buffer.from(secretHex, 'hex'))
    .update(`server|${cn}|${sn}`)
    .digest('hex');
}

export function verifyClientProof(
  secretHex: string,
  sn: string,
  cn: string,
  cp: string
): boolean {
  if (!HEX64.test(cp)) {
    return false;
  }
  const expected = createHmac('sha256', Buffer.from(secretHex, 'hex'))
    .update(`client|${sn}|${cn}`)
    .digest();
  return timingSafeEqual(expected, Buffer.from(cp, 'hex'));
}

// Exact Host match blocks DNS rebinding; the Origin check keeps ordinary web pages out.
export function isAllowedUpgrade(
  headers: { origin?: string; host?: string },
  port: number
): boolean {
  return headers.origin === ALLOWED_ORIGIN && headers.host === `127.0.0.1:${port}`;
}

const jsonObjectSchema = z.record(z.string(), z.unknown());

const helloSchema = z
  .object({
    t: z.literal('hello'),
    v: z.literal(BRIDGE_PROTOCOL),
    plugin: z.literal(BRIDGE_PLUGIN_NAME),
    pv: z.string().max(64),
    ops: z.array(z.string().max(64)).max(256),
    cn: z.string().regex(HEX32),
    host: z.enum(BRIDGE_HOSTS),
  })
  .transform(({ pv, ops, cn, host }) => ({ pv, ops, cn, host }));

const authSchema = z.object({ t: z.literal('auth'), cp: z.string() });

const sessionMessageSchema = z.discriminatedUnion('t', [
  z.object({ t: z.literal('pong') }),
  z.object({
    t: z.literal('res'),
    id: z.number(),
    ok: z.boolean().catch(false),
    value: z.unknown().optional(),
    error: z.string().catch('plugin op failed'),
  }),
]);

export type PluginHello = z.infer<typeof helloSchema>;
export type SessionMessage = z.infer<typeof sessionMessageSchema>;

export function parseFrame(data: RawData): Record<string, unknown> | null {
  try {
    return jsonObjectSchema.safeParse(JSON.parse(data.toString())).data ?? null;
  } catch {
    return null;
  }
}

export function parseHello(msg: unknown): PluginHello | null {
  return helloSchema.safeParse(msg).data ?? null;
}

export function parseAuthProof(msg: unknown): string | null {
  return authSchema.safeParse(msg).data?.cp ?? null;
}

export function parseSessionMessage(msg: unknown): SessionMessage | null {
  return sessionMessageSchema.safeParse(msg).data ?? null;
}

export function sendFrame(ws: WebSocket, message: Record<string, unknown>): boolean {
  if (ws.readyState !== ws.OPEN) {
    return false;
  }
  ws.send(JSON.stringify(message));
  return true;
}
