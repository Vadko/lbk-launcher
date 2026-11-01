// The scripted pull's fastest pace, the furthest apart two teeth of one run ever sound
const TOOTH_GAP_S = 0.04;
// Any closer, two teeth would blur into one click
const MIN_TOOTH_GAP_S = 0.005;

interface RatchetRun {
  // When each tooth sounds, in order
  at: number[];
  // The earliest the next tooth may sound
  free: number;
}

// Teeth passed together sound one after another, behind any still queued, the whole run over `withinS` after `now`
export function ratchetRun(
  now: number,
  free: number,
  count: number,
  withinS: number
): RatchetRun {
  const start = Math.max(now, free);
  const perTooth = (now + withinS - start) / Math.max(1, count);
  const gap = Math.min(TOOTH_GAP_S, Math.max(MIN_TOOTH_GAP_S, perTooth));
  return {
    at: Array.from({ length: count }, (_, index) => start + index * gap),
    free: start + count * gap,
  };
}
