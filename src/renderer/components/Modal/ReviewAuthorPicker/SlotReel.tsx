import { motion } from 'framer-motion';
import { useId } from 'react';
import { REEL_CELL_PX } from './slotReelMotion';
import { useSlotReelMotion } from './useSlotReelMotion';

const CELL = { height: REEL_CELL_PX };

interface SlotReelProps {
  value: string | null;
  decoys: readonly string[];
  isMoving: boolean;
  animate: boolean;
  renderCell: (value: string) => React.ReactNode;
  placeholder: React.ReactNode;
  onLand: () => void;
}

// One flat strip in the reel window; its hold button below carries what a screen reader hears
export function SlotReel({
  value,
  decoys,
  isMoving,
  animate,
  renderCell,
  placeholder,
  onLand,
}: SlotReelProps) {
  const blurId = useId();
  const { cells, y, blurRef, isBlurred, resultIndex } = useSlotReelMotion({
    value,
    decoys,
    isMoving,
    animate,
    onLand,
  });

  return (
    <div className="slot-reel" aria-hidden>
      {/* A CSS blur smears both ways; a real spinning reel smears only along its travel */}
      <svg className="absolute h-0 w-0">
        <filter
          id={blurId}
          x="0"
          y="-20%"
          width="100%"
          height="140%"
          colorInterpolationFilters="sRGB"
        >
          <feGaussianBlur ref={blurRef} stdDeviation="0 0" />
        </filter>
      </svg>
      <div
        className={`slot-reel__strip ${!animate && isMoving ? 'opacity-40' : ''}`}
        style={isBlurred ? { filter: `url("#${blurId}")` } : undefined}
      >
        <motion.div className="flex flex-col" style={{ y }}>
          {cells.map((cell, index) => (
            <div
              key={index}
              className="slot-reel__cell"
              data-result={index === resultIndex || undefined}
              style={CELL}
            >
              {cell === null ? placeholder : renderCell(cell)}
            </div>
          ))}
        </motion.div>
      </div>
    </div>
  );
}
