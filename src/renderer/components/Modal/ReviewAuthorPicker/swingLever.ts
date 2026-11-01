import { playLeverPull } from '../../../utils/slotSounds';

interface LeverSwing {
  animate: boolean;
  // Runs the knob down to its stop
  swing: () => void;
  // A knob that does not move pulls at once
  still?: () => void;
}

// The ratchet and the thunk are the knob's own travel, so with animations off the still knob makes neither
export function swingLever({ animate, swing, still }: LeverSwing): void {
  if (!animate) {
    still?.();
    return;
  }
  playLeverPull();
  swing();
}
