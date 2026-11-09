import { useAnimate } from 'framer-motion';
import { useEffect, useEffectEvent } from 'react';
import {
  flickerDelayMs,
  flickerTarget,
  paylineClear,
  paylineFlash,
  paylineFlicker,
  paylineWin,
} from './slotPaylineMotion';

interface SlotPaylineProps {
  // Grows by one for each new name that comes to rest
  flashes: number;
  isSpinning: boolean;
  isWon: boolean;
  animate: boolean;
}

// The payline across the middle cells and its two ticks; each new name lights it as a winning line, and at rest its neon now and then flickers
export function SlotPayline({ flashes, isSpinning, isWon, animate }: SlotPaylineProps) {
  const [scope, run] = useAnimate<HTMLSpanElement>();

  const flash = useEffectEvent(() => {
    if (animate && !isWon) {
      void run(paylineFlash());
    }
  });

  const win = useEffectEvent(() => {
    void run(paylineWin(animate));
  });

  const clear = useEffectEvent(() => {
    if (animate) {
      void run(paylineClear());
    }
  });

  const flicker = useEffectEvent(() => {
    void run(paylineFlicker(flickerTarget(Math.random())));
  });

  useEffect(() => {
    if (flashes > 0) {
      flash();
    }
  }, [flashes]);

  useEffect(() => {
    if (isWon) {
      win();
    }
  }, [isWon]);

  useEffect(() => {
    if (isSpinning) {
      clear();
    }
  }, [isSpinning]);

  useEffect(() => {
    if (isSpinning || isWon || !animate) {
      return;
    }
    let timer: ReturnType<typeof setTimeout>;
    const wait = () => {
      timer = setTimeout(() => {
        flicker();
        wait();
      }, flickerDelayMs(Math.random()));
    };
    wait();
    return () => clearTimeout(timer);
  }, [isSpinning, isWon, animate]);

  return (
    <span ref={scope} className="slot-payline-set">
      <span className="slot-payline">
        <span className="slot-payline__glow" />
        <span className="slot-payline__clip">
          <span className="slot-payline__lit" />
          <span className="slot-payline__glint" />
        </span>
      </span>
      <span className="slot-tick slot-tick--left">
        <span className="slot-tick__glow" />
      </span>
      <span className="slot-tick slot-tick--right">
        <span className="slot-tick__glow" />
      </span>
    </span>
  );
}
