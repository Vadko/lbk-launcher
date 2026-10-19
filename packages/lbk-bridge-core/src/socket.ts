import { F } from '@mobily/ts-belt';
import pTimeout from 'p-timeout';

export const SOCKET_OPEN = 1;

// The part of a WebSocket the bridge and the page injector use, so tests can play the other end.
export interface BridgeSocket {
  readonly readyState: number;
  send(data: string): void;
  close(code?: number, reason?: string): void;
  onopen: ((ev: Event) => void) | null;
  onmessage: ((ev: MessageEvent) => void) | null;
  onerror: ((ev: Event) => void) | null;
  onclose: ((ev: CloseEvent) => void) | null;
}

// Wrapped in p-timeout, a promise that never settles is a timer on a host's clock that can be cleared or aborted.
export const neverSettles = (): Promise<void> => new Promise<void>(F.ignore);

// A retry delay on the host's clock that resolves at once when signal aborts.
export const abortableDelay =
  (timers: Pick<typeof globalThis, 'setTimeout' | 'clearTimeout'>, signal: AbortSignal) =>
  (ms: number): Promise<void> =>
    pTimeout(neverSettles(), {
      milliseconds: ms,
      message: false,
      customTimers: timers,
      signal,
    }).catch(F.ignore);
