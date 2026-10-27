import { motion } from 'framer-motion';
import React, { useId } from 'react';
import { SlotReelCell } from './SlotReelCell';
import { useSlotReelMotion } from './useSlotReelMotion';

interface SlotReelProps {
  value: string | null;
  decoys: readonly string[];
  isMoving: boolean;
  animate: boolean;
  renderCell: (value: string) => React.ReactNode;
  placeholder: React.ReactNode;
  onLand: () => void;
}

// One cylinder behind the window; its hold button below carries what a screen reader hears
export const SlotReel: React.FC<SlotReelProps> = ({
  value,
  decoys,
  isMoving,
  animate,
  renderCell,
  placeholder,
  onLand,
}) => {
  const blurId = useId();
  const { cells, y, blurRef, isBlurred } = useSlotReelMotion({
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
            <SlotReelCell key={index} y={y} index={index}>
              {cell === null ? placeholder : renderCell(cell)}
            </SlotReelCell>
          ))}
        </motion.div>
      </div>
      <span className="slot-reel__shade" />
    </div>
  );
};
