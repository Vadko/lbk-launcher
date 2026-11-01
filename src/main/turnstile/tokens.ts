import pTimeout from 'p-timeout';
import type { TurnstileAction } from '../../shared/game-reviews-api-types';
import { getMachineId, IS_E2E } from '../tracking';
import { sha256 } from '../utils/hash';
import { captchaPageUrl } from './page-url';
import { reportCaptchaFault } from './report-captcha-fault';
import { solveCaptcha } from './window';

// A cold page load and an invisible solve take seconds; past this the write goes without a token, and the page stays for the next one
const TOKEN_TIMEOUT_MS = 30_000;
// Cloudflare honours a token for 300 s, which leaves the write a minute to reach siteverify
const TOKEN_MAX_AGE_MS = 240_000;

interface Prefetch {
  token: Promise<string | null>;
  startedAt: number;
}

const prefetched = new Map<TurnstileAction, Prefetch>();

// The server recomputes it from the machine id in the body, so a token serves only this machine
function captchaCData(machineId: string): string {
  return sha256(machineId).slice(0, 32);
}

async function requestToken(action: TurnstileAction): Promise<string | null> {
  const url = captchaPageUrl();
  const machineId = getMachineId();
  if (IS_E2E || !url || !machineId) {
    return null;
  }
  const answer = await pTimeout(solveCaptcha(url, action, captchaCData(machineId)), {
    milliseconds: TOKEN_TIMEOUT_MS,
    fallback: () => {
      console.warn(`[Turnstile] ${action}: no token in ${TOKEN_TIMEOUT_MS} ms`);
      reportCaptchaFault('no token in time');
      return null;
    },
  });
  if (answer === null || 'token' in answer) {
    return answer?.token ?? null;
  }
  console.warn(`[Turnstile] ${action}: challenge failed (${answer.error})`);
  // Even a timeout means an interactive challenge, which nobody can solve in a hidden window
  reportCaptchaFault(`challenge failed (${answer.error})`);
  return null;
}

const isFresh = (prefetch: Prefetch) =>
  Date.now() - prefetch.startedAt < TOKEN_MAX_AGE_MS;

// Solved while the user types, so the write does not wait for the challenge
export function prefetchCaptchaToken(action: TurnstileAction): void {
  const current = prefetched.get(action);
  if (current && isFresh(current)) {
    return;
  }
  const prefetch: Prefetch = { token: requestToken(action), startedAt: Date.now() };
  prefetched.set(action, prefetch);
  void prefetch.token.then((token) => {
    if (token === null && prefetched.get(action) === prefetch) {
      prefetched.delete(action);
    }
  });
}

// Single-use: a write takes the prefetched token or solves its own, and nothing keeps it after
export function takeCaptchaToken(action: TurnstileAction): Promise<string | null> {
  const prefetch = prefetched.get(action);
  prefetched.delete(action);
  // A prefetch still solving fails as recently as a new solve would, so its answer stands
  return prefetch && isFresh(prefetch) ? prefetch.token : requestToken(action);
}
