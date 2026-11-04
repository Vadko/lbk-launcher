import { useCallback, useEffect, useRef, useState } from 'react';

export type ActionPhase = 'idle' | 'pending' | 'done' | 'error';

interface ActionPhaseOptions {
  doneMs?: number;
  errorMs?: number;
  /** 0 for instant actions (clipboard): a spinner there is noise */
  minPendingMs?: number;
}

interface RunOptions<T> {
  isSuccess?: (result: T) => boolean;
  /** Success doesn't end the phase — the spinner runs until the control goes away (redirects) */
  holdPending?: boolean;
}

interface AttemptOptions<T> extends RunOptions<T> {
  label: string;
}

const DONE_MS = 1000;
const ERROR_MS = 1800;

// Fast responses (~100 ms) would otherwise skip the spinner, leaving the morph to the checkmark nothing to start from
const MIN_PENDING_MS = 600;

// A throwing predicate doesn't fail the action: the result is returned, but the phase shows a failure
function failsPredicate<T>(
  result: T,
  isSuccess: ((result: T) => boolean) | undefined
): boolean {
  try {
    return isSuccess?.(result) === false;
  } catch (predicateError) {
    console.error('[useActionPhase] isSuccess threw:', predicateError);
    return true;
  }
}

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
  const awaitedRef = useRef(0);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => {
    aliveRef.current = true;
    // A page hidden in <Activity> loses its timers with its effects, so a reveal ends a phase no awaited run will end
    if (awaitedRef.current === 0) {
      clearTimer();
      setPhase('idle');
    }
    return () => {
      aliveRef.current = false;
      clearTimer();
    };
  }, [clearTimer]);

  // The minimum spinner time is held by a timer, not by a pause in run(): the caller must not wait on the animation
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
      // Generation token: a stale run must not paint its result over a fresh one
      const generation = ++generationRef.current;
      awaitedRef.current = generation;
      clearTimer();
      startedAtRef.current = Date.now();
      setPhase('pending');
      const settled = action().finally(() => {
        if (awaitedRef.current === generation) {
          awaitedRef.current = 0;
        }
      });
      let result: T;
      try {
        result = await settled;
      } catch (error) {
        if (generation === generationRef.current) {
          hold('error');
        }
        throw error;
      }

      const failed = failsPredicate(result, options?.isSuccess);
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
        console.error(`[${options.label}] action failed:`, error);
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
    /** The control stays on screen while the phase burns down — instead of delaying the data itself */
    isBusy: phase !== 'idle',
    run,
    attempt,
    reset,
  };
}
