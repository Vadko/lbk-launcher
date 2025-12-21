import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LazyLoadImage } from 'react-lazy-load-image-component';
import 'react-lazy-load-image-component/src/effects/blur.css';
import type { Game } from '../../types/game';
import { getGameImageUrl } from '../../utils/imageUrl';

interface GameHeroProps {
  game: Game;
}

/**
 * Перевірити чи картинка має прозорі кути
 */
function checkImageHasTransparentCorners(img: HTMLImageElement): boolean {
  try {
    console.log(
      '[GameHero] Checking transparency for:',
      img.src,
      'size:',
      img.naturalWidth,
      'x',
      img.naturalHeight
    );

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      console.log('[GameHero] No canvas context');
      return true;
    }

    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    ctx.drawImage(img, 0, 0);

    const checkPixel = (x: number, y: number): boolean => {
      const data = ctx.getImageData(x, y, 1, 1).data;
      console.log(`[GameHero] Pixel at (${x}, ${y}): alpha=${data[3]}`);
      return data[3] < 250; // Альфа < 250 = прозорий
    };

    // Перевіряємо кути
    const result =
      checkPixel(0, 0) ||
      checkPixel(canvas.width - 1, 0) ||
      checkPixel(0, canvas.height - 1) ||
      checkPixel(canvas.width - 1, canvas.height - 1);

    console.log('[GameHero] Has transparency:', result);
    return result;
  } catch (error) {
    console.error('[GameHero] Error checking transparency:', error);
    return true; // При помилці - без скруглення
  }
}

export const GameHero: React.FC<GameHeroProps> = ({ game }) => {
  const bannerUrl = getGameImageUrl(game.banner_path, game.updated_at);
  const logoUrl = getGameImageUrl(game.logo_path, game.updated_at);

  const [bannerError, setBannerError] = useState(false);
  const [logoError, setLogoError] = useState(false);
  const [shouldRoundLogo, setShouldRoundLogo] = useState(false);

  // Reset state when game changes
  /* eslint-disable react-hooks/set-state-in-effect -- intentional reset on prop change */
  useEffect(() => {
    setBannerError(false);
    setLogoError(false);
    setShouldRoundLogo(false);
  }, [game.id]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Перевірити прозорість при завантаженні лого
  const handleLogoLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    console.log('[GameHero] Logo loaded, checking transparency...');
    const img = e.currentTarget;
    const hasTransparency = checkImageHasTransparentCorners(img);
    setShouldRoundLogo(!hasTransparency);
  }, []);

  const showBanner = bannerUrl && !bannerError;
  const showLogo = logoUrl && !logoError;

  return (
    <div className="relative h-[300px] rounded-2xl overflow-hidden mb-6 select-none">
      {/* Banner placeholder - only visible when banner is unavailable */}
      {!showBanner && (
        <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-neon-purple via-neon-blue to-neon-pink opacity-30" />
      )}

      {/* Banner image */}
      <AnimatePresence mode="wait">
        {showBanner && (
          <motion.div
            key={game.id}
            className="absolute inset-0"
            initial={{ opacity: 0, scale: 1.02 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{
              duration: 0.2,
              ease: [0.25, 0.46, 0.45, 0.94],
            }}
          >
            <LazyLoadImage
              src={bannerUrl}
              alt={game.name}
              effect="blur"
              wrapperClassName="w-full h-full"
              className="w-full h-full rounded-2xl object-cover"
              draggable={false}
              onError={() => setBannerError(true)}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-bg-dark via-bg-dark/50 to-transparent" />

      {/* Game logo */}
      <div className="relative h-full flex items-end p-8">
        <AnimatePresence mode="wait">
          {showLogo ? (
            <motion.div
              key={`logo-${game.id}`}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{
                duration: 0.2,
                delay: 0.05,
                ease: [0.25, 0.46, 0.45, 0.94],
              }}
            >
              <img
                src={logoUrl}
                alt={game.name}
                className={`max-h-32 max-w-md object-contain drop-shadow-[0_0_20px_rgba(0,0,0,0.8)] transition-[border-radius] duration-300 ${shouldRoundLogo ? 'rounded-xl' : 'rounded-none'}`}
                draggable={false}
                crossOrigin="anonymous"
                onLoad={handleLogoLoad}
                onError={() => setLogoError(true)}
              />
            </motion.div>
          ) : (
            <motion.h1
              key={`title-${game.id}`}
              className="text-5xl font-head font-bold text-white drop-shadow-[0_0_20px_rgba(0,0,0,0.8)]"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{
                duration: 0.2,
                delay: 0.05,
                ease: [0.25, 0.46, 0.45, 0.94],
              }}
            >
              {game.name}
            </motion.h1>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
