import { useAnimate } from 'framer-motion';
import { ThumbsUpIcon } from 'lucide-react';
import React, { useCallback } from 'react';
import {
  useHasEverInstalledTranslation,
  useIsTranslationInstalledForGame,
} from '@/renderer/hooks/useInstalledTranslations';
import { useLikesStore } from '@/renderer/store/useLikesStore';
import { useSettingsStore } from '@/renderer/store/useSettingsStore';
import { t } from '@/shared/i18n/i18n';
import { AppNumberFlow } from './AppNumberFlow';
import { Button } from './Button';

interface LikeButtonProps {
  gameId: string;
  likes: number;
}

export const LikeButton: React.FC<LikeButtonProps> = ({ gameId, likes }) => {
  const isTranslationInstalled = useIsTranslationInstalledForGame(gameId);
  const hasEverInstalled = useHasEverInstalledTranslation(gameId);
  const canRate = isTranslationInstalled || hasEverInstalled;
  const isLiked = useLikesStore((state) => state.likedGameIds.has(gameId));
  const animationsEnabled = useSettingsStore((state) => state.animationsEnabled);
  const [iconRef, animateIcon] = useAnimate<HTMLSpanElement>();

  const handleClick = useCallback(() => {
    if (!canRate) {
      return;
    }
    const { likedGameIds, toggleLike } = useLikesStore.getState();
    const liking = !likedGameIds.has(gameId);
    toggleLike(gameId);
    if (liking && animationsEnabled && iconRef.current) {
      void animateIcon(
        iconRef.current,
        { scale: [1, 1.35, 0.92, 1], rotate: [0, -16, 6, 0] },
        { duration: 0.5, ease: 'easeOut' }
      );
    }
  }, [gameId, canRate, animationsEnabled, animateIcon, iconRef]);

  return (
    <Button
      variant="secondary"
      icon={
        <span ref={iconRef} className="inline-flex">
          <ThumbsUpIcon
            size={20}
            className={`fill-current transition-[fill-opacity] duration-200 ${isLiked ? '[fill-opacity:1]' : '[fill-opacity:0]'}`}
          />
        </span>
      }
      onClick={handleClick}
      disabled={!canRate}
      data-gamepad-action
      className="px-4! gap-1!"
      title={
        canRate
          ? isLiked
            ? t('gameLike.unlike')
            : t('gameLike.like')
          : t('gameLike.needsInstall')
      }
    >
      {likes > 0 && (
        // number-flow pads each digit for its mask; at the default line height the button outgrows its 54px neighbours
        <AppNumberFlow className="text-sm leading-none" value={likes} />
      )}
    </Button>
  );
};
