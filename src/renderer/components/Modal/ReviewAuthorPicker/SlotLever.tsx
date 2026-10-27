import { motion, useTransform } from 'framer-motion';
import React from 'react';
import { t } from '@/shared/i18n/i18n';
import { useSettingsStore } from '../../../store/useSettingsStore';
import { LEVER_ROD_PX, leverPose } from './slotLeverMotion';
import { useLeverPull } from './useLeverPull';

interface SlotLeverProps {
  canPull: boolean;
  pulledAt: number;
  animate: boolean;
  onPull: () => void;
}

// Bolted to a rail on the cabinet's right side; pulled with a click, a key, the gamepad, or by dragging the ball down
export const SlotLever: React.FC<SlotLeverProps> = ({
  canPull,
  pulledAt,
  animate,
  onPull,
}) => {
  const hintSeen = useSettingsStore((s) => s.reviewLeverHintSeen);
  const markHintSeen = useSettingsStore((s) => s.markReviewLeverHintSeen);
  const { angle, handlers } = useLeverPull({ canPull, pulledAt, animate, onPull });
  const reach = useTransform(angle, (deg) => leverPose(deg).reach);
  const ballY = useTransform(angle, (deg) => -LEVER_ROD_PX * leverPose(deg).reach);
  const ballScale = useTransform(angle, (deg) => leverPose(deg).ballScale);
  // Gamepad and keyboard never hover, so focus counts as the first look too
  const seeHint = () => {
    if (!hintSeen) {
      markHintSeen();
    }
  };

  return (
    <button
      type="button"
      aria-label={t('reviewAuthorPicker.lever')}
      aria-disabled={!canPull || undefined}
      {...handlers}
      onPointerEnter={seeHint}
      onFocus={seeHint}
      data-gamepad-modal-item
      className="slot-lever aria-disabled:cursor-wait"
    >
      <span className="slot-lever__rail" />
      <motion.span
        className="slot-lever__rod"
        style={{ height: LEVER_ROD_PX, scaleY: reach }}
      />
      <span className="slot-lever__hub" />
      <motion.span className="slot-lever__knob" style={{ y: ballY, scale: ballScale }}>
        {!hintSeen && (
          <span className={`slot-lever__hint ${animate ? 'animate-lever-hint' : ''}`} />
        )}
        <span className="slot-lever__ball" />
      </motion.span>
    </button>
  );
};
