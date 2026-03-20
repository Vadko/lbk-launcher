import { useCallback, useEffect, useReducer } from 'react';
import { useStore } from '../store/useStore';

type EaseArray = [number, number, number, number];

interface AnimationProps {
  initial: { opacity: number; x?: number; y?: number };
  animate: { opacity: number; x?: number; y?: number };
  transition: {
    duration: number;
    delay?: number;
    ease: EaseArray;
  };
}

interface UseListAnimationOptions {
  /** Slug list to track changes */
  slugs: string[];
  /** Whether animations are enabled globally */
  animationsEnabled: boolean;
  /** How many items get staggered entrance on app start */
  staggerCount: number;
  /** Animation direction: 'y' for vertical, 'x' for horizontal */
  direction: 'x' | 'y';
}

const EASE_OUT_EXPO: EaseArray = [0.22, 1, 0.36, 1];
/** How long to keep prevSlugs stale so animations can finish (ms) */
const ANIMATION_DURATION_MS = 400;

interface AnimState {
  prevSlugs: Set<string>;
  initialStaggerDone: boolean;
}

type AnimAction = { type: 'update_slugs'; slugs: string[] } | { type: 'stagger_done' };

function animReducer(state: AnimState, action: AnimAction): AnimState {
  switch (action.type) {
    case 'update_slugs':
      return { ...state, prevSlugs: new Set(action.slugs) };
    case 'stagger_done':
      return { ...state, initialStaggerDone: true };
  }
}

/**
 * Shared animation logic for game lists (vertical & horizontal).
 * Returns a function that provides motion props for each item.
 */
export function useListAnimation({
  slugs,
  animationsEnabled,
  staggerCount,
  direction,
}: UseListAnimationOptions) {
  const loaderVisible = useStore((s) => s.loaderVisible);

  const [state, dispatch] = useReducer(animReducer, {
    prevSlugs: new Set<string>(),
    initialStaggerDone: false,
  });

  // Delay prevSlugs update so animation has time to play.
  // During the delay, listChanged (computed at render time) stays true
  // and items remain as motion.div until animation completes.
  const slugsKey = slugs.join(',');
  useEffect(() => {
    const timer = setTimeout(() => {
      dispatch({ type: 'update_slugs', slugs });
    }, ANIMATION_DURATION_MS);
    return () => clearTimeout(timer);
  }, [slugsKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Mark initial stagger as done after animations complete
  useEffect(() => {
    if (loaderVisible || state.initialStaggerDone) return;
    const splashExitMs = 300;
    const staggerMs = staggerCount * 50 + ANIMATION_DURATION_MS;
    const timer = setTimeout(
      () => dispatch({ type: 'stagger_done' }),
      splashExitMs + staggerMs
    );
    return () => clearTimeout(timer);
  }, [loaderVisible, state.initialStaggerDone, staggerCount]);

  const skipAll = !animationsEnabled || loaderVisible;
  const isInitialAppear = !state.initialStaggerDone && !loaderVisible;

  // Compute listChanged during render (not via effect) so it's
  // available on the same render cycle as the data change
  const listChanged =
    !isInitialAppear &&
    state.prevSlugs.size > 0 &&
    (slugs.length !== state.prevSlugs.size || slugs.some((s) => !state.prevSlugs.has(s)));

  const offset = direction === 'x' ? { opacity: 0, x: 20 } : { opacity: 0, y: 20 };
  const target = direction === 'x' ? { opacity: 1, x: 0 } : { opacity: 1, y: 0 };

  /**
   * Get framer-motion props for an item.
   * Returns null if the item should render as a plain div.
   */
  const getAnimationProps = useCallback(
    (slug: string, index: number): AnimationProps | null => {
      if (skipAll) return null;

      if (isInitialAppear) {
        const delay =
          index < staggerCount ? 0.3 + index * 0.05 : 0.3 + staggerCount * 0.05;
        return {
          initial: offset,
          animate: target,
          transition: { duration: 0.4, delay, ease: EASE_OUT_EXPO },
        };
      }

      if (!listChanged && state.prevSlugs.has(slug)) return null;

      return {
        initial: offset,
        animate: target,
        transition: { duration: 0.35, ease: EASE_OUT_EXPO },
      };
    },
    [skipAll, isInitialAppear, staggerCount, offset, target, listChanged, state.prevSlugs]
  );

  return { getAnimationProps };
}
