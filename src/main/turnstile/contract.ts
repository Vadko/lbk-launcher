import { z } from 'zod';
import { CAPTCHA_CHANNELS } from '../../shared/captcha-channels';

// The actions lbk-admin's turnstileVerdict.ts expects, one per kind of public write
export const turnstileActionSchema = z.enum(['review', 'reply', 'edit', 'nickname']);

export type TurnstileAction = z.infer<typeof turnstileActionSchema>;

export interface CaptchaRequest {
  requestId: string;
  action: TurnstileAction;
  cData: string;
}

export type PageMessage =
  | { type: 'ready' }
  | { type: 'unavailable'; code: string }
  | { type: 'resolve'; requestId: string; token: string }
  | { type: 'reject'; requestId: string; code: string };

type PageChannel = Exclude<
  (typeof CAPTCHA_CHANNELS)[keyof typeof CAPTCHA_CHANNELS],
  typeof CAPTCHA_CHANNELS.request
>;

// The captcha page's own request id rule, reused for the codes it sends back
const name = z.string().regex(/^[A-Za-z0-9_-]{1,64}$/);
// The server's isTurnstileToken bound
const token = z.string().min(1).max(2048);

// Each page call arrives as its IPC arguments, and the page is remote, so every one is checked
export const PAGE_MESSAGES: Record<PageChannel, z.ZodType<PageMessage>> = {
  [CAPTCHA_CHANNELS.ready]: z.tuple([]).transform(() => ({ type: 'ready' as const })),
  [CAPTCHA_CHANNELS.unavailable]: z
    .tuple([name])
    .transform(([code]) => ({ type: 'unavailable' as const, code })),
  [CAPTCHA_CHANNELS.resolve]: z
    .tuple([name, token])
    .transform(([requestId, token]) => ({ type: 'resolve' as const, requestId, token })),
  [CAPTCHA_CHANNELS.reject]: z
    .tuple([name, name])
    .transform(([requestId, code]) => ({ type: 'reject' as const, requestId, code })),
};
