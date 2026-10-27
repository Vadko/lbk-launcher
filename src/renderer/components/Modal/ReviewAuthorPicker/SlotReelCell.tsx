import { type MotionValue, motion, useTransform } from 'framer-motion';
import React from 'react';
import { REEL_CELL_PX, reelCellProjection } from './slotReelMotion';

interface SlotReelCellProps {
  // The strip's y, which turns the drum
  y: MotionValue<number>;
  index: number;
  children: React.ReactNode;
}

// One symbol on the drum: it squashes and slides toward the window's edge as the drum turns it away
export const SlotReelCell: React.FC<SlotReelCellProps> = ({ y, index, children }) => {
  const shift = useTransform(y, (stripY) => reelCellProjection(stripY, index).shift);
  const scaleY = useTransform(y, (stripY) => reelCellProjection(stripY, index).scale);
  const opacity = useTransform(y, (stripY) =>
    reelCellProjection(stripY, index).visible ? 1 : 0
  );

  return (
    <motion.div
      className="flex shrink-0 items-center justify-center px-2"
      style={{ height: REEL_CELL_PX, y: shift, scaleY, opacity }}
    >
      {children}
    </motion.div>
  );
};
