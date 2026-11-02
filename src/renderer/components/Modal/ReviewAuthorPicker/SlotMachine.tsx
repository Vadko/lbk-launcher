import React, { useEffect } from 'react';
import type { NicknameSpin } from '@/shared/game-reviews-api-types';
import { useIdleEffect } from '../../../hooks/useIdleEffect';
import { decodePlayerAvatars, playerAvatarUri } from '../../../utils/playerAvatar';
import { playWinChime, warmSlotSounds } from '../../../utils/slotSounds';
import { type NicknameFont, nicknameFitStyle } from './nicknameFitStyle';
import type { PickerNotice } from './pickerNotice';
import { SlotHoldButton } from './SlotHoldButton';
import { SlotLever } from './SlotLever';
import { SlotPayline } from './SlotPayline';
import { SlotReel } from './SlotReel';
import { SlotResult } from './SlotResult';
import { SlotStatusLine } from './SlotStatusLine';
import { everyReel, type ReelFlags, SLOT_REELS, type SlotReelId } from './slotReels';
import { usePaylineFlash } from './usePaylineFlash';
import { useReelSounds } from './useReelSounds';

interface SlotMachineProps {
  spin: NicknameSpin | null;
  heldSpin: NicknameSpin | null;
  holds: ReelFlags;
  moving: ReelFlags;
  pulledAt: number;
  // From the pull until the last reel is at rest
  isSpinning: boolean;
  // The claim took the dealt name
  isWon: boolean;
  notice: PickerNotice | null;
  canHold: boolean;
  canPull: boolean;
  // At 0 the knob stays locked until the picker opens again
  spinsLeft: number | null;
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

const WORD_FONT: NicknameFont = { weight: 600, sizePx: 15 };

const wordCell = (word: string) => (
  <span className="slot-reel__word" style={nicknameFitStyle(word, WORD_FONT)}>
    {word}
  </span>
);

const wordPlaceholder = <span className="h-2 w-20 rounded-full bg-white/8" />;

const REELS: Record<SlotReelId, ReelLook> = {
  avatar: {
    value: (spin) => spin.avatarSeed,
    decoys: (spin) => spin.decoys.avatarSeeds,
    renderCell: (seed) => (
      <img src={playerAvatarUri(seed)} alt="" className="slot-reel__avatar" />
    ),
    placeholder: <span className="slot-reel__avatar bg-white/8" />,
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

export const SlotMachine: React.FC<SlotMachineProps> = ({
  spin,
  heldSpin,
  holds,
  moving,
  pulledAt,
  isSpinning,
  isWon,
  notice,
  canHold,
  canPull,
  spinsLeft,
  animate,
  onToggleHold,
  onPull,
}) => {
  const reelLanded = useReelSounds(moving, isSpinning, animate);
  const flashes = usePaylineFlash(spin, isSpinning);
  const allHeld = everyReel(holds);

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

  const land = (reel: SlotReelId) => {
    // A brake that rAF held back while the window was hidden finishes after the spin has ended
    if (isSpinning) {
      reelLanded(reel);
    }
  };

  const shown = (reel: SlotReelId) => (holds[reel] && heldSpin ? heldSpin : spin);

  return (
    <div className="slot-machine">
      <div className="slot-play">
        <div className="slot-window">
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
          <SlotPayline
            flashes={flashes}
            isSpinning={isSpinning}
            isWon={isWon}
            animate={animate}
          />
        </div>
        <SlotLever
          canPull={canPull && !allHeld}
          isLocked={spinsLeft === 0 || allHeld}
          pulledAt={pulledAt}
          animate={animate}
          onPull={onPull}
        />
      </div>
      <div className="slot-holds">
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
              onToggleHold={onToggleHold}
            />
          );
        })}
      </div>
      <div>
        <SlotResult spin={spin} isSpinning={isSpinning} spinsLeft={spinsLeft} />
        <SlotStatusLine notice={notice} showReleaseHint={allHeld && canPull} />
      </div>
    </div>
  );
};
