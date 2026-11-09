import { motion, useTransform } from 'framer-motion';
import { t } from '@/shared/i18n/i18n';
import { useSettingsStore } from '../../../store/useSettingsStore';
import { LEVER_TRAVEL_PX } from './slotLeverMotion';
import { useLeverPull } from './useLeverPull';

const glow = (blur: number, spread: number, alpha: number) =>
  `0 0 ${blur}px ${spread}px rgba(255, 164, 122, ${alpha})`;

// The knob's halo until the first look; with animations off it stays still
const HALO = {
  pulse: [glow(4, 0, 0.2), glow(14, 4, 0.5), glow(4, 0, 0.2)],
  still: glow(10, 2, 0.35),
  off: glow(0, 0, 0),
};

const HALO_PULSE = { duration: 1.6, ease: 'easeInOut', repeat: Infinity } as const;

interface SlotLeverProps {
  canPull: boolean;
  // Out of spins or every reel held rather than busy: a stop sign, not a wait
  isLocked: boolean;
  pulledAt: number;
  animate: boolean;
  onPull: () => void;
}

// The gamepad focuses the dialog's first item on open, so only focus moved within the dialog is the player's own
const isFocusFromDialog = (event: React.FocusEvent<HTMLElement>): boolean =>
  event.relatedTarget instanceof Node &&
  !!event.currentTarget.closest('[role="dialog"]')?.contains(event.relatedTarget);

// A knob on a track beside the reels; pulled with a click, a key, the gamepad, or by dragging it down
export function SlotLever({
  canPull,
  isLocked,
  pulledAt,
  animate,
  onPull,
}: SlotLeverProps) {
  const hintSeen = useSettingsStore((s) => s.reviewLeverHintSeen);
  const markHintSeen = useSettingsStore((s) => s.markReviewLeverHintSeen);
  const { travel, handlers } = useLeverPull({ canPull, pulledAt, animate, onPull });
  const knobY = useTransform(travel, (value) => value * LEVER_TRAVEL_PX);
  const fill = useTransform(travel, (value) => Math.min(1, Math.max(0, value)));
  // Gamepad and keyboard never hover, so moving focus to the knob or pressing it counts as the first look too
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
      onClick={(event) => {
        seeHint();
        handlers.onClick?.(event);
      }}
      onPointerEnter={seeHint}
      onFocus={(event) => {
        if (isFocusFromDialog(event)) {
          seeHint();
        }
      }}
      data-gamepad-modal-item
      data-locked={isLocked || undefined}
      className="slot-lever"
    >
      <span className="slot-lever__track" />
      <motion.span className="slot-lever__fill" style={{ scaleY: fill }} />
      <motion.span className="slot-lever__knob" style={{ y: knobY }}>
        <motion.span
          className="slot-lever__halo"
          animate={{ boxShadow: hintSeen ? HALO.off : animate ? HALO.pulse : HALO.still }}
          transition={hintSeen || !animate ? { duration: animate ? 0.2 : 0 } : HALO_PULSE}
        />
        <span className="slot-lever__ball" />
      </motion.span>
    </button>
  );
}
