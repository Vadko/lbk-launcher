import { playLeverPull } from '../../../utils/slotSounds';

interface LeverSwing {
  animate: boolean;
  // Runs the arm down to its stop
  swing: () => void;
  // A lever that does not move pulls at once
  still?: () => void;
}

// The ratchet and the thunk are the arm's own travel, so with animations off the upright lever makes neither
export function swingLever({ animate, swing, still }: LeverSwing): void {
  if (!animate) {
    still?.();
    return;
  }
  playLeverPull();
  swing();
}
