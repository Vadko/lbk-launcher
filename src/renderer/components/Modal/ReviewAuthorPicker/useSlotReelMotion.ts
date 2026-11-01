import {
  type AnimationPlaybackControlsWithThen,
  animate as animateValue,
  type MotionValue,
  useMotionValue,
  useMotionValueEvent,
  useVelocity,
} from 'framer-motion';
import { useEffectEvent, useLayoutEffect, useRef, useState } from 'react';
import {
  brakeMotion,
  heldReelRest,
  type ReelCell,
  type ReelMotionStep,
  type ReelRest,
  recoilMotion,
  reelBlur,
  reelOffset,
  restCells,
  settleStrip,
  spinLoopMotion,
  spinStrip,
  spinUpMotion,
} from './slotReelMotion';

type ReelPhase =
  | { kind: 'rest' }
  | { kind: 'spin'; cells: ReelCell[]; loop: number }
  | { kind: 'settle'; cells: ReelCell[] };

const REST: ReelPhase = { kind: 'rest' };

// The resting and the settling strips both start with the result's upper neighbour
const RESULT_INDEX = 1;

interface ReelMotionInput {
  value: ReelCell;
  decoys: readonly string[];
  isMoving: boolean;
  animate: boolean;
  // The reel hits its stop, just before it knocks back onto the result
  onLand: () => void;
}

interface ReelMotion {
  cells: ReelCell[];
  y: MotionValue<number>;
  blurRef: React.RefObject<SVGFEGaussianBlurElement | null>;
  isBlurred: boolean;
  // The cell that holds the result, lit as soon as the brake brings it in; null while the strip loops
  resultIndex: number | null;
}

// Set on the filter directly, every frame, without a render; the smear runs only along the travel
function paintBlur(
  blur: SVGFEGaussianBlurElement | null,
  speed: number,
  isSpinning: boolean
): void {
  blur?.setAttribute('stdDeviation', `0 ${reelBlur(speed, isSpinning)}`);
}

const spinPhase = (value: ReelCell, decoys: readonly string[]): ReelPhase => ({
  kind: 'spin',
  ...spinStrip(value, decoys),
});

export function useSlotReelMotion({
  value,
  decoys,
  isMoving,
  animate,
  onLand,
}: ReelMotionInput): ReelMotion {
  // What the reel came to rest on, so a held reel keeps its neighbours while the others spin
  const [rest, setRest] = useState<ReelRest>({ value, decoys });
  const [wasMoving, setWasMoving] = useState(isMoving);
  const [phase, setPhase] = useState<ReelPhase>(() =>
    isMoving && animate ? spinPhase(value, decoys) : REST
  );
  const y = useMotionValue(reelOffset(1));
  const velocity = useVelocity(y);
  const blurRef = useRef<SVGFEGaussianBlurElement>(null);
  const land = useEffectEvent(onLand);

  const held = heldReelRest(rest, value, decoys);
  // Switched in the render that sees the change, so the new strip and its start position paint together
  if (isMoving !== wasMoving) {
    setWasMoving(isMoving);
    if (isMoving) {
      setPhase(animate ? spinPhase(value, rest.decoys) : REST);
    } else {
      setRest({ value, decoys });
      setPhase(animate ? { kind: 'settle', cells: settleStrip(value, decoys) } : REST);
    }
  } else {
    if (!isMoving && held !== rest) {
      setRest(held);
    }
    if (!animate && phase.kind !== 'rest') {
      setPhase(REST);
    }
  }

  useLayoutEffect(() => {
    paintBlur(blurRef.current, velocity.get(), phase.kind === 'spin');
    if (phase.kind === 'rest') {
      y.set(reelOffset(1));
      return undefined;
    }
    let live = true;
    let current: AnimationPlaybackControlsWithThen | null = null;
    const run = (step: ReelMotionStep, next?: () => void) => {
      y.set(step.keyframes[0]);
      current = animateValue(y, step.keyframes, step.transition);
      void current.finished.then(() => {
        if (live) {
          next?.();
        }
      });
    };
    if (phase.kind === 'spin') {
      run(spinUpMotion(phase.loop), () => run(spinLoopMotion(phase.loop)));
    } else {
      run(brakeMotion(), () => {
        land();
        run(recoilMotion(), () => setPhase(REST));
      });
    }
    return () => {
      live = false;
      current?.stop();
    };
  }, [phase, velocity, y]);

  useMotionValueEvent(velocity, 'change', (speed) =>
    paintBlur(blurRef.current, speed, phase.kind === 'spin')
  );

  return {
    cells: phase.kind === 'rest' ? restCells(value, rest.decoys) : phase.cells,
    y,
    blurRef,
    isBlurred: phase.kind !== 'rest',
    resultIndex: phase.kind === 'spin' ? null : RESULT_INDEX,
  };
}
