import { useState } from 'react';
import type { NicknameSpin } from '@/shared/game-reviews-api-types';

interface Landed {
  spinId: string | null;
  count: number;
}

// Counts the spins that came to rest while the picker is open: a failed pull lands nothing new, and the spin it opened on was never dealt here
export function usePaylineFlash(spin: NicknameSpin | null, isSpinning: boolean): number {
  const [landed, setLanded] = useState<Landed>({
    spinId: spin?.spinId ?? null,
    count: 0,
  });
  const restingId = isSpinning ? landed.spinId : (spin?.spinId ?? null);
  if (restingId !== landed.spinId) {
    setLanded({ spinId: restingId, count: landed.count + (restingId === null ? 0 : 1) });
  }
  return landed.count;
}
