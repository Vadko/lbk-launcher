import { z } from 'zod';
import { CAPTCHA_CHANNELS } from '../../shared/captcha-channels';
import type { TurnstileAction } from '../../shared/game-reviews-api-types';

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

// Each page call arrives as its IPC arguments, and the page is remote, so every one is checked
export const PAGE_MESSAGES: Record<PageChannel, z.ZodType<PageMessage>> = {
  [CAPTCHA_CHANNELS.ready]: z.tuple([]).transform(() => ({ type: 'ready' as const })),
  [CAPTCHA_CHANNELS.unavailable]: z
    .tuple([z.string()])
    .transform(([code]) => ({ type: 'unavailable' as const, code })),
  [CAPTCHA_CHANNELS.resolve]: z
    .tuple([z.string(), z.string()])
    .transform(([requestId, token]) => ({ type: 'resolve' as const, requestId, token })),
  [CAPTCHA_CHANNELS.reject]: z
    .tuple([z.string(), z.string()])
    .transform(([requestId, code]) => ({ type: 'reject' as const, requestId, code })),
};
