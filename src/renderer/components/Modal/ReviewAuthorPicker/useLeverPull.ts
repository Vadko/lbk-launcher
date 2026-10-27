import {
  type AnimationPlaybackControlsWithThen,
  animate as animateValue,
  type MotionValue,
  useMotionValue,
  type ValueAnimationTransition,
} from 'framer-motion';
import { useEffect, useEffectEvent, useRef } from 'react';
import { playLeverThunk, playRatchetClick } from '../../../utils/slotSounds';
import {
  LEVER_BOTTOM_DWELL_S,
  LEVER_DOWN_DEG,
  LEVER_DRAG_SLOP_PX,
  LEVER_PULL,
  LEVER_PULL_DEG,
  LEVER_RETURN,
  leverAngleForDrag,
  leverFinishTransition,
  ratchetTooth,
} from './slotLeverMotion';
import { swingLever } from './swingLever';

interface LeverPullInput {
  canPull: boolean;
  // Changes with every pull, the machine's own respins included
  pulledAt: number;
  animate: boolean;
  onPull: () => void;
}

interface LeverDrag {
  startY: number;
  moved: boolean;
  tooth: number;
}

interface LeverPull {
  // The arm's angle: 0 upright, 90 toward the viewer, 180 pulled down
  angle: MotionValue<number>;
  handlers: Pick<
    React.ButtonHTMLAttributes<HTMLButtonElement>,
    'onClick' | 'onPointerDown' | 'onPointerMove' | 'onPointerUp' | 'onPointerCancel'
  >;
}

export function useLeverPull({
  canPull,
  pulledAt,
  animate,
  onPull,
}: LeverPullInput): LeverPull {
  const angle = useMotionValue(0);
  const motion = useRef<AnimationPlaybackControlsWithThen | null>(null);
  const drag = useRef<LeverDrag | null>(null);
  // The next pulledAt comes from this lever's own pull, which has already moved and sounded
  const ownPull = useRef(false);
  // The click that ends a drag is not a second pull
  const skipClick = useRef(false);
  // A pull lands at the bottom of the swing, by when the machine may have stopped taking one
  const canPullNow = useRef(canPull);
  // A pull under way takes no second one until the arm reaches its stop
  const swinging = useRef(false);

  useEffect(() => {
    canPullNow.current = canPull;
  }, [canPull]);

  const move = (
    to: number,
    transition: ValueAnimationTransition<number>,
    then?: () => void
  ) => {
    motion.current?.stop();
    const controls = animateValue(angle, to, transition);
    motion.current = controls;
    void controls.finished.then(() => {
      if (motion.current === controls) {
        then?.();
      }
    });
  };

  const springBack = (delay = 0) => move(0, { ...LEVER_RETURN, delay });

  const pull = () => {
    if (canPullNow.current) {
      ownPull.current = true;
      onPull();
    }
  };

  const swingDown = (
    transition: ValueAnimationTransition<number>,
    atBottom: () => void
  ) =>
    move(LEVER_DOWN_DEG, transition, () => {
      atBottom();
      springBack(LEVER_BOTTOM_DWELL_S);
    });

  const pullDown = (
    transition: ValueAnimationTransition<number>,
    atBottom: () => void
  ) => {
    swinging.current = true;
    swingDown(transition, () => {
      swinging.current = false;
      atBottom();
    });
  };

  const respin = useEffectEvent(() => {
    if (ownPull.current) {
      ownPull.current = false;
      return;
    }
    // The user's pull has just swung and sounded, so the arm finishes its return instead of snapping upright
    if (angle.get() > 1) {
      return;
    }
    swingLever({
      animate,
      swing: () => {
        swinging.current = false;
        angle.set(0);
        swingDown(LEVER_PULL, () => undefined);
      },
    });
  });

  useEffect(() => {
    if (pulledAt > 0) {
      respin();
    }
  }, [pulledAt]);

  useEffect(() => () => motion.current?.stop(), []);

  const endDrag = (commit: boolean) => {
    const current = drag.current;
    drag.current = null;
    if (!current?.moved) {
      return;
    }
    // A cancelled pointer gets no click
    skipClick.current = commit;
    const reached = angle.get();
    if (commit && canPull && reached >= LEVER_PULL_DEG) {
      pullDown(leverFinishTransition(reached), () => {
        playLeverThunk();
        pull();
      });
    } else {
      springBack();
    }
  };

  return {
    angle,
    handlers: {
      onClick: (event) => {
        const afterDrag = skipClick.current;
        skipClick.current = false;
        // Keys and the gamepad's el.click() have detail 0; a touch drag may end with no click
        if (afterDrag && event.detail > 0) {
          return;
        }
        if (!canPull || swinging.current) {
          return;
        }
        swingLever({ animate, swing: () => pullDown(LEVER_PULL, pull), still: pull });
      },
      onPointerDown: (event) => {
        skipClick.current = false;
        // A second press during the swing would stop it, and a stopped swing never pulls
        if (event.button !== 0 || !canPull || !animate || swinging.current) {
          return;
        }
        event.currentTarget.setPointerCapture(event.pointerId);
        motion.current?.stop();
        drag.current = { startY: event.clientY, moved: false, tooth: 0 };
      },
      onPointerMove: (event) => {
        const current = drag.current;
        if (!current) {
          return;
        }
        const distance = event.clientY - current.startY;
        if (!current.moved && Math.abs(distance) < LEVER_DRAG_SLOP_PX) {
          return;
        }
        current.moved = true;
        const reached = leverAngleForDrag(distance);
        angle.set(reached);
        const tooth = ratchetTooth(reached);
        if (tooth > current.tooth) {
          playRatchetClick();
        }
        current.tooth = tooth;
      },
      onPointerUp: () => endDrag(true),
      onPointerCancel: () => endDrag(false),
    },
  };
}
