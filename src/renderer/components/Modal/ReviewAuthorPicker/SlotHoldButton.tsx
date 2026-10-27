import { LockIcon } from 'lucide-react';
import React from 'react';
import { t } from '@/shared/i18n/i18n';
import { playHoldClick } from '../../../utils/slotSounds';
import type { SlotReelId } from './slotReels';

interface SlotHoldButtonProps {
  reel: SlotReelId;
  // What a screen reader hears the reel show; the avatar reel has none
  spokenValue: string | null;
  isMoving: boolean;
  isHeld: boolean;
  canHold: boolean;
  // Two other reels are held, and a third hold is never allowed
  isLocked: boolean;
  onToggleHold: (reel: SlotReelId) => void;
}

// A lit push-button cap under its reel; a held one latches down and glows
export const SlotHoldButton: React.FC<SlotHoldButtonProps> = ({
  reel,
  spokenValue,
  isMoving,
  isHeld,
  canHold,
  isLocked,
  onToggleHold,
}) => {
  const name = t(`reviewAuthorPicker.reel.${reel}`);
  const isEnabled = canHold && !isLocked;

  return (
    <button
      type="button"
      aria-busy={isMoving || undefined}
      aria-pressed={isHeld}
      aria-disabled={!isEnabled || undefined}
      onClick={() => {
        if (isEnabled) {
          playHoldClick();
          onToggleHold(reel);
        }
      }}
      data-gamepad-modal-item
      className="slot-hold justify-self-center"
    >
      {isLocked && <LockIcon size={10} className="shrink-0" aria-hidden />}
      <span className="min-w-0 truncate">
        {t(isHeld ? 'reviewAuthorPicker.held' : 'reviewAuthorPicker.hold')}
      </span>{' '}
      {/* After the visible label, so a voice command that says it still finds the button */}
      <span className="sr-only">
        {spokenValue === null || isMoving
          ? name
          : t('reviewAuthorPicker.reelValue', { reel: name, value: spokenValue })}
      </span>
    </button>
  );
};
