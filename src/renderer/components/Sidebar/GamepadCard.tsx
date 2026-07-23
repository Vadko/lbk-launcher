import { useDeferredImage } from '@renderer/hooks/useDeferredImage';
import type { Game } from '@renderer/types/game';
import { getGameImageUrl } from '@renderer/utils/imageUrl';
import { useSettingsStore } from '@store/useSettingsStore';
import { EyeOff } from 'lucide-react';
import React, { useState } from 'react';
import { StatusIcons } from '../Elements/StatusIcons';
import { Loader } from '../ui/Loader';

interface GamepadCardProps {
  game: Game;
  translations: Game[];
  translationIndex?: number;
  isSelected: boolean;
  hasUpdate: boolean;
  isDetected: boolean;
  isInstalled: boolean;
  onClick: () => void;
  imageDeferred?: boolean;
}

export const GamepadCard: React.FC<GamepadCardProps> = ({
  game,
  translations,
  isSelected,
  hasUpdate,
  isDetected,
  isInstalled,
  onClick,
  imageDeferred = false,
}) => {
  const hasMultipleTranslations = translations.length > 1;
  const [loadedUrl, setLoadedUrl] = useState<string | null>(null);
  const [erroredUrl, setErroredUrl] = useState<string | null>(null);
  const [bannerGameId, setBannerGameId] = useState<string | null>(null);
  const imageSettled = useDeferredImage(imageDeferred, game.id);
  const showAdultGames = useSettingsStore((state) => state.showAdultGames);
  const isFavoriteGame = useSettingsStore((state) => state.isFavoriteGame);
  const isTranslationAvailable =
    game.status !== 'planned' && game.status !== 'tech-improvement';

  const thumbnailUrl = getGameImageUrl(game.thumbnail_path, game.updated_at);
  const bannerUrl = getGameImageUrl(game.banner_path, game.updated_at);
  const useBanner = bannerGameId === game.id;
  const imageUrl = useBanner ? bannerUrl : thumbnailUrl;
  const imageError = erroredUrl === imageUrl;
  const imageLoading = loadedUrl !== imageUrl;
  const isAdultBlurred = game.is_adult && !showAdultGames;

  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    // If thumbnail is low quality (small), switch to banner
    if (!useBanner && img.naturalWidth > 0 && img.naturalWidth < 300 && bannerUrl) {
      setBannerGameId(game.id);
      return;
    }
    setLoadedUrl(imageUrl);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick();
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      data-gamepad-card
      className={`
        relative flex-shrink-0 w-36 rounded-xl overflow-hidden cursor-pointer
        transition-all duration-200 outline-none
        ${
          isSelected
            ? 'ring-2 ring-color-accent shadow-[0_0_20px_rgba(255,164,122,0.5)] scale-105 z-10'
            : 'ring-1 ring-white/10 hover:ring-white/30 hover:scale-102'
        }
      `}
    >
      {/* Adult blur overlay */}
      {isAdultBlurred && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/70 backdrop-blur-md">
          <EyeOff size={24} className="text-white/50" />
        </div>
      )}

      {/* Image */}
      <div
        className={`relative aspect-[3/4] bg-glass ${isAdultBlurred ? 'blur-lg' : ''}`}
      >
        {imageUrl && !imageError ? (
          <>
            {imageLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-glass">
                <Loader size="sm" />
              </div>
            )}
            {imageSettled && (
              <img
                src={imageUrl}
                alt={game.name}
                draggable={false}
                decoding="async"
                className={`w-full h-full object-cover transition-opacity duration-200 ${
                  imageLoading ? 'opacity-0' : 'opacity-100'
                } ${useBanner ? 'object-[left_center]' : ''}`}
                onLoad={handleImageLoad}
                onError={() => setErroredUrl(imageUrl)}
              />
            )}
          </>
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-color-main/50 to-color-accent/50 flex items-center justify-center">
            <span className="text-white/70 font-bold text-2xl">
              {game.name.charAt(0)}
            </span>
          </div>
        )}

        {/* Translations count badge */}
        {hasMultipleTranslations && !isAdultBlurred && (
          <div className="absolute top-2 left-2 min-w-[20px] h-5 px-1.5 bg-color-main rounded-full flex items-center justify-center">
            <span className="text-[10px] font-bold text-text-dark">
              {translations.length}
            </span>
          </div>
        )}

        {/* Indicators */}
        {!isAdultBlurred && (
          <StatusIcons
            hasUpdate={hasUpdate}
            isGameDetected={isDetected}
            isInstalled={isInstalled}
            aiType={game.ai}
            floatPosition="compact"
            isTranslationAvailable={isTranslationAvailable}
            isFavorite={isFavoriteGame(game.id)}
          />
        )}
        {/* Game name and team */}
        <div className="absolute inset-x-0 bottom-0 p-2 h-16 bg-gradient-to-t from-black/80 to-transparent grid content-end">
          <p
            className={`text-xs font-medium text-white line-clamp-1 ${isAdultBlurred ? 'blur-sm' : ''}`}
          >
            {game.name}
          </p>
          {!hasMultipleTranslations && (
            <p
              className={`text-[10px] text-color-accent truncate ${isAdultBlurred ? 'blur-sm' : ''}`}
            >
              {game.team}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
