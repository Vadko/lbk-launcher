import { vi } from 'vitest';
import type { ResourceUpdate } from '@/shared/resources';

export type Ids = ReadonlySet<string>;

// Keeps a copy of each update, as the port's structured clone does
export function sink() {
  const sent: ResourceUpdate[] = [];
  const postMessage = vi.fn((update: ResourceUpdate) => {
    sent.push(structuredClone(update));
  });
  return { sent, postMessage, close: vi.fn() };
}

// Each call waits for finish(); the nth call resolves with the nth value, the last one repeating
export function controlledRead(...values: Ids[]) {
  const pending: Array<() => void> = [];
  const read = vi.fn(
    () =>
      new Promise<Ids>((resolve) => {
        const value = values[Math.min(read.mock.calls.length, values.length) - 1];
        pending.push(() => resolve(value));
      })
  );
  return { read, finish: () => pending.shift()?.() };
}
