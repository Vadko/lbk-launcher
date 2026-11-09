import { useEffect, useRef } from 'react';
import { playReelStop, type ReelWhirr, startReelWhirr } from '../../../utils/slotSounds';
import { anyReel, type ReelFlags, SLOT_REELS, type SlotReelId } from './slotReels';

interface ReelNoise {
  whirr: ReelWhirr | null;
  // A reel stops being `moving` when its brake starts, so it spins on here until it lands
  spinning: Set<SlotReelId>;
}

function silence(noise: ReelNoise): void {
  noise.whirr?.stop();
  noise.whirr = null;
  noise.spinning.clear();
}

// The spin bed while reels spin, quieter as each stops, and a note per stop; returns what a reel calls when it lands
export function useReelSounds(
  moving: ReelFlags,
  isSpinning: boolean,
  animate: boolean
): (reel: SlotReelId) => void {
  const noise = useRef<ReelNoise>({ whirr: null, spinning: new Set() });
  const wasMoving = useRef(anyReel(moving));

  useEffect(() => {
    const anyMoving = anyReel(moving);
    const current = noise.current;
    if (!animate) {
      silence(current);
      // Without motion the results appear together, so they land on the last reel's note
      if (wasMoving.current && !anyMoving) {
        playReelStop(SLOT_REELS.length - 1);
      }
    } else {
      for (const reel of SLOT_REELS.filter((id) => moving[id])) {
        current.spinning.add(reel);
      }
      if (current.spinning.size > 0) {
        current.whirr = current.whirr ?? startReelWhirr();
      }
    }
    wasMoving.current = anyMoving;
  }, [animate, moving]);

  // The landings run on animation frames, which a hidden window never gets; the machine's timers still fire
  useEffect(() => {
    if (!isSpinning) {
      silence(noise.current);
    }
  }, [isSpinning]);

  useEffect(() => {
    const current = noise.current;
    const hush = () => silence(current);
    const hushWhenHidden = () => {
      if (document.hidden) {
        silence(current);
      }
    };
    window.addEventListener('blur', hush);
    document.addEventListener('visibilitychange', hushWhenHidden);
    return () => {
      window.removeEventListener('blur', hush);
      document.removeEventListener('visibilitychange', hushWhenHidden);
      silence(current);
    };
  }, []);

  return (reel) => {
    const current = noise.current;
    current.spinning.delete(reel);
    playReelStop(SLOT_REELS.indexOf(reel));
    if (current.spinning.size === 0) {
      silence(current);
    } else {
      current.whirr?.setLevel(current.spinning.size / SLOT_REELS.length);
    }
  };
}
