import { randomUUID } from 'node:crypto';
import pTimeout from 'p-timeout';
import { getMachineId, IS_E2E } from '../tracking';
import { sha256 } from '../utils/hash';
import type { TurnstileAction } from './contract';
import { captchaPageUrl } from './page-url';
import { reportCaptchaFault } from './report-captcha-fault';
import { type CaptchaPageListener, openCaptchaPage } from './window';

// A cold page load and an invisible solve take seconds; past this the write goes without a token, and the page stays for the next one
const TOKEN_TIMEOUT_MS = 30_000;
// Cloudflare honours a token for 300 s, which leaves the write a minute to reach siteverify
const TOKEN_MAX_AGE_MS = 240_000;

interface OpenRequest {
  action: TurnstileAction;
  settle: (token: string | null) => void;
}

interface Prefetch {
  token: Promise<string | null>;
  startedAt: number;
}

const openRequests = new Map<string, OpenRequest>();
const prefetched = new Map<TurnstileAction, Prefetch>();

const listener: CaptchaPageListener = {
  answer: (answer) => {
    const request = openRequests.get(answer.requestId);
    if (!request) {
      return;
    }
    if (answer.type === 'reject') {
      console.warn(`[Turnstile] ${request.action}: challenge failed (${answer.code})`);
      // Even a timeout means an interactive challenge, which nobody can solve in a hidden window
      reportCaptchaFault(`challenge failed (${answer.code})`);
    }
    request.settle(answer.type === 'resolve' ? answer.token : null);
  },
  lost: () => {
    for (const request of openRequests.values()) {
      request.settle(null);
    }
  },
};

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
  const requestId = randomUUID();
  const answer = new Promise<string | null>((settle) => {
    openRequests.set(requestId, { action, settle });
  });
  const solved = openCaptchaPage(url, listener).then((send) => {
    if (!send) {
      return null;
    }
    send({ requestId, action, cData: captchaCData(machineId) });
    return answer;
  });
  const token = await pTimeout(solved, {
    milliseconds: TOKEN_TIMEOUT_MS,
    fallback: () => {
      console.warn(`[Turnstile] ${action}: no token in ${TOKEN_TIMEOUT_MS} ms`);
      reportCaptchaFault('no token in time');
      return null;
    },
  });
  openRequests.delete(requestId);
  return token;
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
