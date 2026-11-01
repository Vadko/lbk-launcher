import { motion, PresenceContext } from 'framer-motion';
import React, { useContext, useState } from 'react';
import { useSettingsStore } from '../../store/useSettingsStore';
import { REVIEW_REVEAL_MS } from './reviewRevealMs';

interface ReviewRevealProps {
  children: React.ReactNode;
}

// Clips only while moving: framer never applies a transitionEnd overflow after a height 'auto' entrance
export const ReviewReveal: React.FC<ReviewRevealProps> = ({ children }) => {
  const animationsEnabled = useSettingsStore((state) => state.animationsEnabled);
  const presence = useContext(PresenceContext);
  // Rows already on screen when their list first renders skip the entrance
  const [isMoving, setIsMoving] = useState(presence?.initial !== false);

  return (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: 'auto', opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={{
        duration: animationsEnabled ? REVIEW_REVEAL_MS / 1000 : 0,
        ease: 'easeOut',
      }}
      onAnimationStart={() => setIsMoving(true)}
      onAnimationComplete={() => setIsMoving(false)}
      className={isMoving && animationsEnabled ? 'overflow-hidden' : undefined}
    >
      {children}
    </motion.div>
  );
};
