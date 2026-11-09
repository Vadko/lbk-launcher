import { vi } from 'vitest';
import type { ResourceUpdate } from '@/shared/resources';

// Keeps a copy of each update, as the port's structured clone does
export function sink() {
  const sent: ResourceUpdate[] = [];
  const postMessage = vi.fn((update: ResourceUpdate) => {
    sent.push(structuredClone(update));
  });
  return { sent, postMessage, close: vi.fn() };
}
