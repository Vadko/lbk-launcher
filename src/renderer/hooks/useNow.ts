import { useEffect, useState } from 'react';

export function useNow(intervalMs: number, until = Infinity): number {
  const [now, setNow] = useState(Date.now);
  const isRunning = now < until;

  useEffect(() => {
    if (!isRunning) {
      return;
    }
    const tick = () => setNow(Date.now());
    const id = setInterval(tick, intervalMs);
    // The last tick lands on `until` itself, even when the timer fires a millisecond early
    const end = Number.isFinite(until)
      ? setTimeout(() => setNow(Math.max(Date.now(), until)), until - Date.now())
      : undefined;
    return () => {
      clearInterval(id);
      clearTimeout(end);
    };
  }, [intervalMs, isRunning, until]);

  return now;
}
