import { LockIcon } from 'lucide-react';
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
  onToggleHold: (reel: SlotReelId) => void;
}

// A pill under its reel; a held one takes the accent
export function SlotHoldButton({
  reel,
  spokenValue,
  isMoving,
  isHeld,
  canHold,
  onToggleHold,
}: SlotHoldButtonProps) {
  const name = t(`reviewAuthorPicker.reel.${reel}`);

  return (
    <button
      type="button"
      aria-busy={isMoving || undefined}
      aria-pressed={isHeld}
      aria-disabled={!canHold || undefined}
      onClick={() => {
        if (canHold) {
          playHoldClick(!isHeld);
          onToggleHold(reel);
        }
      }}
      data-gamepad-modal-item
      className="slot-hold"
    >
      <LockIcon size={13} strokeWidth={2.25} className="shrink-0" aria-hidden />
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
}
