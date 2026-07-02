import { type DependencyList, useEffect } from 'react';

export function useIdleEffect(
  effect: () => void,
  deps: DependencyList,
  timeout = 2000
): void {
  // biome-ignore lint/correctness/useExhaustiveDependencies: caller owns `deps`.
  useEffect(() => {
    const id = requestIdleCallback(effect, { timeout });
    return () => cancelIdleCallback(id);
  }, deps);
}
