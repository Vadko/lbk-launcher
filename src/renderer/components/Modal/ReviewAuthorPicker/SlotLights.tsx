import React from 'react';
import { type BulbMode, bulbFrame, bulbTiming } from './slotBulbs';

interface SlotLightsProps {
  mode: BulbMode;
}

const FRAME = bulbFrame(22, 5);

// The marquee bulbs round the reel window, peach and green in turn
export const SlotLights: React.FC<SlotLightsProps> = ({ mode }) => (
  <div className="slot-lights" data-mode={mode} aria-hidden>
    {FRAME.map(({ x, y }, index) => {
      const { periodMs, delayMs } = bulbTiming(index, mode);
      return (
        <span
          key={`${x},${y}`}
          className={`slot-bulb ${index % 2 === 0 ? 'slot-bulb--peach' : 'slot-bulb--green'}`}
          style={{ left: `${x * 100}%`, top: `${y * 100}%` }}
        >
          <span
            className="slot-bulb__light"
            style={{ animationDuration: `${periodMs}ms`, animationDelay: `${delayMs}ms` }}
          />
        </span>
      );
    })}
  </div>
);
