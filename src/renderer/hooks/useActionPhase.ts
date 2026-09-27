import { useCallback, useEffect, useRef, useState } from 'react';

export type ActionPhase = 'idle' | 'pending' | 'done' | 'error';

interface ActionPhaseOptions {
  doneMs?: number;
  errorMs?: number;
  minPendingMs?: number;
}

interface RunOptions<T> {
  isSuccess?: (result: T) => boolean;
  holdPending?: boolean;
}

interface AttemptOptions<T> extends RunOptions<T> {
  label: string;
}

const DONE_MS = 1000;
const ERROR_MS = 1800;

const MIN_PENDING_MS = 600;

export function useActionPhase({
  doneMs = DONE_MS,
  errorMs = ERROR_MS,
  minPendingMs = MIN_PENDING_MS,
}: ActionPhaseOptions = {}) {
  const [phase, setPhase] = useState<ActionPhase>('idle');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const aliveRef = useRef(true);
  const startedAtRef = useRef(0);
  const generationRef = useRef(0);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
      clearTimer();
    };
  }, [clearTimer]);

  const hold = useCallback(
    (next: 'done' | 'error') => {
      clearTimer();
      const remaining = Math.max(0, minPendingMs - (Date.now() - startedAtRef.current));
      timerRef.current = setTimeout(() => {
        if (!aliveRef.current) {
          timerRef.current = null;
          return;
        }
        setPhase(next);
        timerRef.current = setTimeout(
          () => {
            timerRef.current = null;
            if (aliveRef.current) {
              setPhase('idle');
            }
          },
          next === 'done' ? doneMs : errorMs
        );
      }, remaining);
    },
    [clearTimer, doneMs, errorMs, minPendingMs]
  );

  const run = useCallback(
    async <T>(action: () => Promise<T>, options?: RunOptions<T>): Promise<T> => {
      const generation = ++generationRef.current;
      clearTimer();
      startedAtRef.current = Date.now();
      setPhase('pending');
      let result: T;
      try {
        result = await action();
      } catch (error) {
        if (generation === generationRef.current) {
          hold('error');
        }
        throw error;
      }

      let failed = false;
      try {
        failed = options?.isSuccess?.(result) === false;
      } catch (predicateError) {
        console.error('[useActionPhase] isSuccess threw:', predicateError);
        failed = true;
      }
      if (generation === generationRef.current && !(!failed && options?.holdPending)) {
        hold(failed ? 'error' : 'done');
      }
      return result;
    },
    [clearTimer, hold]
  );

  const attempt = useCallback(
    async <T>(
      action: () => Promise<T>,
      options: AttemptOptions<T>
    ): Promise<T | undefined> => {
      try {
        return await run(action, options);
      } catch (error) {
        console.error(`[${options.label}] дія не виконалась:`, error);
        return undefined;
      }
    },
    [run]
  );

  const reset = useCallback(() => {
    generationRef.current += 1;
    clearTimer();
    setPhase('idle');
  }, [clearTimer]);

  return {
    phase,
    isPending: phase === 'pending',
    isBusy: phase !== 'idle',
    run,
    attempt,
    reset,
  };
}
