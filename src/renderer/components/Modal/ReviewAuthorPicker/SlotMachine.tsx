import { useAnimate } from 'framer-motion';
import React, { useEffect } from 'react';
import type { NicknameSpin } from '@/shared/game-reviews-api-types';
import { useIdleEffect } from '../../../hooks/useIdleEffect';
import { decodePlayerAvatars, playerAvatarUri } from '../../../utils/playerAvatar';
import { playWinChime, warmSlotSounds } from '../../../utils/slotSounds';
import { isHoldLocked } from './isHoldLocked';
import type { PickerNotice } from './pickerNotice';
import { SlotHoldButton } from './SlotHoldButton';
import { SlotLever } from './SlotLever';
import { SlotLights } from './SlotLights';
import { SlotMessageDisplay } from './SlotMessageDisplay';
import { SlotReel } from './SlotReel';
import type { BulbMode } from './slotBulbs';
import { type ReelFlags, SLOT_REELS, type SlotReelId } from './slotReels';
import { useReelSounds } from './useReelSounds';

interface SlotMachineProps {
  spin: NicknameSpin | null;
  heldSpin: NicknameSpin | null;
  holds: ReelFlags;
  moving: ReelFlags;
  pulledAt: number;
  // From the pull until the last reel is at rest
  isSpinning: boolean;
  // The claimed name; null until the claim goes through
  wonName: string | null;
  notice: PickerNotice | null;
  canHold: boolean;
  canPull: boolean;
  animate: boolean;
  onToggleHold: (reel: SlotReelId) => void;
  onPull: () => void;
}

interface ReelLook {
  value: (spin: NicknameSpin) => string;
  decoys: (spin: NicknameSpin) => readonly string[];
  renderCell: (value: string) => React.ReactNode;
  placeholder: React.ReactNode;
  // The avatar is a picture, so only the words go into the hold button's accessible name
  spoken: boolean;
}

const wordCell = (word: string) => <span className="slot-reel__word">{word}</span>;

const wordPlaceholder = <span className="h-2.5 w-24 rounded-full bg-black/10" />;

const REELS: Record<SlotReelId, ReelLook> = {
  avatar: {
    value: (spin) => spin.avatarSeed,
    decoys: (spin) => spin.decoys.avatarSeeds,
    renderCell: (seed) => (
      <img src={playerAvatarUri(seed)} alt="" className="slot-reel__avatar" />
    ),
    placeholder: <span className="h-12 w-12 rounded-full bg-black/10" />,
    spoken: false,
  },
  adjective: {
    value: (spin) => spin.adjective,
    decoys: (spin) => spin.decoys.adjectives,
    renderCell: wordCell,
    placeholder: wordPlaceholder,
    spoken: true,
  },
  noun: {
    value: (spin) => spin.noun,
    decoys: (spin) => spin.decoys.nouns,
    renderCell: wordCell,
    placeholder: wordPlaceholder,
    spoken: true,
  },
};

const NO_DECOYS: readonly string[] = [];

// The window and the button shelf share these columns, so every hold button sits under its reel
const REEL_COLUMNS = 'grid grid-cols-3 gap-1';

const lightsMode = (animate: boolean, isWon: boolean, isSpinning: boolean): BulbMode => {
  if (!animate) {
    return 'still';
  }
  if (isWon) {
    return 'win';
  }
  return isSpinning ? 'chase' : 'idle';
};

export const SlotMachine: React.FC<SlotMachineProps> = ({
  spin,
  heldSpin,
  holds,
  moving,
  pulledAt,
  isSpinning,
  wonName,
  notice,
  canHold,
  canPull,
  animate,
  onToggleHold,
  onPull,
}) => {
  const [machineScope, animateMachine] = useAnimate<HTMLDivElement>();
  const reelLanded = useReelSounds(moving, isSpinning, animate);
  const isWon = wonName !== null;

  useEffect(() => {
    if (isWon) {
      playWinChime();
    }
  }, [isWon]);

  useEffect(() => {
    if (spin) {
      decodePlayerAvatars(spin.decoys.avatarSeeds);
    }
  }, [spin]);

  useIdleEffect(warmSlotSounds, []);

  // Each stop knocks the whole cabinet, as a reel hitting its detent does
  const land = (reel: SlotReelId) => {
    // A brake that rAF held back while the window was hidden finishes after the spin has ended
    if (!isSpinning) {
      return;
    }
    reelLanded(reel);
    if (animate) {
      void animateMachine(
        machineScope.current,
        { y: [0, 3, -1.5, 0.5, 0] },
        { duration: 0.22 }
      );
    }
  };

  const shown = (reel: SlotReelId) => (holds[reel] && heldSpin ? heldSpin : spin);

  return (
    <div ref={machineScope} className="slot-machine">
      <div className="slot-cabinet">
        <SlotMessageDisplay
          notice={notice}
          wonName={wonName}
          canPull={canPull}
          animate={animate}
        />
        <div className="slot-lightboard">
          <SlotLights mode={lightsMode(animate, isWon, isSpinning)} />
          <div className="slot-bezel">
            <span className="slot-payline-marker slot-payline-marker--left" />
            <span className="slot-payline-marker slot-payline-marker--right" />
            <div className={`slot-window ${REEL_COLUMNS}`}>
              {SLOT_REELS.map((reel) => {
                const look = REELS[reel];
                const reelSpin = shown(reel);
                return (
                  <SlotReel
                    key={reel}
                    value={reelSpin ? look.value(reelSpin) : null}
                    decoys={spin ? look.decoys(spin) : NO_DECOYS}
                    isMoving={moving[reel]}
                    animate={animate}
                    renderCell={look.renderCell}
                    placeholder={look.placeholder}
                    onLand={() => land(reel)}
                  />
                );
              })}
            </div>
          </div>
        </div>
        <div className={`slot-deck ${REEL_COLUMNS}`}>
          {SLOT_REELS.map((reel) => {
            const look = REELS[reel];
            const reelSpin = shown(reel);
            return (
              <SlotHoldButton
                key={reel}
                reel={reel}
                spokenValue={look.spoken && reelSpin ? look.value(reelSpin) : null}
                isMoving={moving[reel]}
                isHeld={holds[reel]}
                canHold={canHold}
                isLocked={isHoldLocked(holds, reel)}
                onToggleHold={onToggleHold}
              />
            );
          })}
        </div>
      </div>
      <SlotLever
        canPull={canPull}
        pulledAt={pulledAt}
        animate={animate}
        onPull={onPull}
      />
    </div>
  );
};
