import {
  type AnimationPlaybackControlsWithThen,
  animate as animateValue,
  type MotionValue,
  useMotionValue,
  type ValueAnimationTransition,
} from 'framer-motion';
import { useEffect, useEffectEvent, useRef } from 'react';
import { playLeverThunk, playRatchetRun } from '../../../utils/slotSounds';
import {
  LEVER_BOTTOM_DWELL_S,
  LEVER_DRAG_SLOP_PX,
  LEVER_DRAG_STEP_S,
  LEVER_PULL,
  LEVER_RETURN,
  leverFinishTransition,
  leverReleasePulls,
  leverTravelForDrag,
  ratchetTooth,
  teethLeftBelow,
  teethPassed,
} from './slotLeverMotion';
import { swingLever } from './swingLever';

// Closer to the top than this, the knob counts as at rest
const RESTING_TRAVEL = 0.01;

interface LeverPullInput {
  canPull: boolean;
  // Changes with every pull, the machine's own respins included
  pulledAt: number;
  animate: boolean;
  onPull: () => void;
}

interface LeverDrag {
  // Another pointer resting on the knob, a trackpad cursor beside a touch, takes no part in this drag
  pointerId: number;
  startY: number;
  moved: boolean;
  tooth: number;
}

interface LeverPull {
  // 0 at rest, 1 at the bottom stop, below 0 while the spring swings past rest
  travel: MotionValue<number>;
  handlers: Pick<
    React.ButtonHTMLAttributes<HTMLButtonElement>,
    | 'onClick'
    | 'onPointerDown'
    | 'onPointerMove'
    | 'onPointerUp'
    | 'onPointerCancel'
    | 'onLostPointerCapture'
  >;
}

export function useLeverPull({
  canPull,
  pulledAt,
  animate,
  onPull,
}: LeverPullInput): LeverPull {
  const travel = useMotionValue(0);
  const motion = useRef<AnimationPlaybackControlsWithThen | null>(null);
  const drag = useRef<LeverDrag | null>(null);
  // The next pulledAt comes from this lever's own pull, which has already moved and sounded
  const ownPull = useRef(false);
  // The click that ends a drag is not a second pull
  const skipClick = useRef(false);
  // A pull lands at the bottom of the swing, by when the machine may have stopped taking one
  const canPullNow = useRef(canPull);
  // A pull under way takes no second one until the knob reaches its stop
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
    const controls = animateValue(travel, to, transition);
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
    move(1, transition, () => {
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
    // The user's pull has just run and sounded, so the knob finishes its return instead of snapping up
    if (travel.get() > RESTING_TRAVEL) {
      return;
    }
    swingLever({
      animate,
      swing: () => {
        swinging.current = false;
        travel.set(0);
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
      // A press can stop the knob on its way home, and a dropped press gets no click to swing it
      if (current && travel.get() !== 0) {
        springBack();
      }
      return;
    }
    // A drag of any kind ends with no pull from the click the browser may still send
    skipClick.current = true;
    const reached = travel.get();
    const pulls = commit && canPull && leverReleasePulls(reached);
    // The knob follows the hand either way; with animations off it jumps home instead of swinging on
    if (!animate) {
      travel.set(0);
      if (pulls) {
        pull();
      }
    } else if (pulls) {
      const finish = leverFinishTransition(reached);
      // The knob runs on through the teeth it has left, so every pull sounds the whole run before the thunk
      playRatchetRun(teethLeftBelow(current.tooth), finish.duration);
      pullDown(finish, () => {
        playLeverThunk();
        pull();
      });
    } else {
      springBack();
    }
  };

  // Leaving the window mid-drag is no release, so the knob goes home
  const dropDrag = useEffectEvent(() => endDrag(false));

  useEffect(() => {
    const onBlur = () => dropDrag();
    window.addEventListener('blur', onBlur);
    return () => window.removeEventListener('blur', onBlur);
  }, []);

  const ownPointer = (event: React.PointerEvent) =>
    drag.current?.pointerId === event.pointerId;

  return {
    travel,
    handlers: {
      onClick: (event) => {
        // A key or the gamepad mid-drag would start a swing the drag's end then stops halfway
        if (drag.current) {
          return;
        }
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
        // A second press during the swing would stop it, and a stopped swing never pulls; one drag at a time
        if (event.button !== 0 || !canPull || swinging.current || drag.current) {
          return;
        }
        event.currentTarget.setPointerCapture(event.pointerId);
        motion.current?.stop();
        drag.current = {
          pointerId: event.pointerId,
          startY: event.clientY,
          moved: false,
          tooth: 0,
        };
      },
      onPointerMove: (event) => {
        const current = drag.current;
        if (!current || !ownPointer(event)) {
          return;
        }
        // A release outside the window can go unreported, and the next move comes with no button down
        if ((event.buttons & 1) === 0) {
          const knob = event.currentTarget;
          if (knob.hasPointerCapture(event.pointerId)) {
            knob.releasePointerCapture(event.pointerId);
          }
          endDrag(true);
          return;
        }
        const distance = event.clientY - current.startY;
        if (!current.moved && Math.abs(distance) < LEVER_DRAG_SLOP_PX) {
          return;
        }
        current.moved = true;
        const reached = leverTravelForDrag(distance);
        travel.set(reached);
        const tooth = ratchetTooth(reached);
        // A tooth clicks whenever the knob passes it going down, again after the hand backs up, so its pitch marks the knob's place
        playRatchetRun(teethPassed(current.tooth, tooth), LEVER_DRAG_STEP_S);
        current.tooth = tooth;
      },
      onPointerUp: (event) => {
        if (ownPointer(event)) {
          endDrag(true);
        }
      },
      onPointerCancel: (event) => {
        if (ownPointer(event)) {
          endDrag(false);
        }
      },
      // Capture lost without a pointerup, over a window drag region or to the system, still ends the drag
      onLostPointerCapture: (event) => {
        if (ownPointer(event)) {
          endDrag((event.buttons & 1) === 0);
        }
      },
    },
  };
}
