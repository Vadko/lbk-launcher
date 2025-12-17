import React, { useState } from 'react';
import { EyeOff } from 'lucide-react';
import type { Game } from '../../types/game';
import { getGameImageUrl } from '../../utils/imageUrl';
import { Loader } from '../ui/Loader';
import { useSettingsStore } from '../../store/useSettingsStore';
import { useImagePreload } from '../../hooks/useImagePreload';

interface GameListItemProps {
  game: Game;
  isSelected: boolean;
  onClick: () => void;
  hasUpdate?: boolean;
  isGameDetected?: boolean;
  showTeamName?: boolean;
  isHorizontalMode?: boolean;
}

export const GameListItem: React.FC<GameListItemProps> = React.memo(
  ({ game, isSelected, onClick, hasUpdate = false, isGameDetected = false, showTeamName = false, isHorizontalMode = false }) => {
    const [imageLoading, setImageLoading] = useState(true);
    const [imageError, setImageError] = useState(false);
    const showAdultGames = useSettingsStore((state) => state.showAdultGames);

    // Check if this is an adult game that should be blurred
    const isAdultBlurred = game.is_adult && !showAdultGames;

    const averageProgress = Math.round(
      (game.translation_progress + game.editing_progress) / 2
    );

    const thumbnailUrl = getGameImageUrl(game.thumbnail_path, game.updated_at);
    const bannerUrl = getGameImageUrl(game.banner_path, game.updated_at);
    const logoUrl = getGameImageUrl(game.logo_path, game.updated_at);

    // Preload banner and logo when this item becomes visible
    const preloadRef = useImagePreload([bannerUrl, logoUrl]);

    const handleKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onClick();
      }
    };

    // Horizontal compact mode for gamepad
    if (isHorizontalMode) {
      return (
        <div
          ref={preloadRef}
          role="button"
          tabIndex={0}
          onClick={onClick}
          onKeyDown={handleKeyDown}
          data-gamepad-card
          className={`game-list-item relative w-[200px] rounded-xl cursor-pointer transition-all duration-300 outline-none focus:ring-2 focus:ring-neon-blue focus:shadow-[0_0_20px_rgba(0,242,255,0.4)] ${
            isSelected
              ? 'ring-2 ring-neon-blue shadow-[0_0_20px_rgba(0,242,255,0.4)]'
              : 'ring-1 ring-white/10 hover:ring-white/30'
          }`}
        >
          {/* Adult content blur overlay */}
          {isAdultBlurred && (
            <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-black/60 backdrop-blur-sm">
              <EyeOff size={16} className="text-white/70" />
            </div>
          )}

          {/* Thumbnail */}
          <div className={`relative h-24 bg-glass rounded-t-xl overflow-hidden ${isAdultBlurred ? 'blur-md' : ''}`}>
            {thumbnailUrl && !imageError ? (
              <>
                {imageLoading && (
                  <div className="absolute inset-0 flex items-center justify-center bg-glass">
                    <Loader size="sm" />
                  </div>
                )}
                <img
                  src={thumbnailUrl}
                  alt={game.name}
                  draggable={false}
                  className={`w-full h-full object-cover transition-opacity duration-300 ${
                    imageLoading ? 'opacity-0' : 'opacity-100'
                  }`}
                  onLoad={() => setImageLoading(false)}
                  onError={() => {
                    setImageError(true);
                    setImageLoading(false);
                  }}
                />
              </>
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-neon-purple to-neon-blue flex items-center justify-center text-white font-bold text-2xl">
                {game.name.charAt(0)}
              </div>
            )}

            {/* Indicators */}
            {hasUpdate && !isAdultBlurred && (
              <div className="absolute top-2 right-2 w-3 h-3 bg-neon-blue rounded-full animate-pulse" />
            )}
            {isGameDetected && !isAdultBlurred && (
              <div
                className="absolute bottom-2 right-2 w-3 h-3 bg-green-500 rounded-full"
                title="Гра встановлена"
              />
            )}
          </div>

          {/* Info */}
          <div className={`p-3 bg-glass-hover rounded-b-xl ${isAdultBlurred ? 'blur-md' : ''}`}>
            <h4 className="font-medium text-sm text-white mb-2 truncate">
              {game.name}
            </h4>
            <div className="h-1 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-neon-blue to-neon-purple rounded-full transition-all duration-500"
                style={{ width: `${averageProgress}%` }}
              />
            </div>
          </div>
        </div>
      );
    }

    // Vertical mode (default)
    return (
      <div
        ref={preloadRef}
        role="button"
        tabIndex={0}
        onClick={onClick}
        onKeyDown={handleKeyDown}
        data-nav-group="game-list"
        className={`game-list-item relative flex gap-3 p-3 rounded-xl cursor-pointer transition-all duration-300 ${
          isSelected
            ? 'bg-[rgba(0,242,255,0.1)] border border-[rgba(0,242,255,0.5)] shadow-[0_0_20px_rgba(0,242,255,0.2)]'
            : 'bg-glass border border-transparent hover:bg-glass-hover hover:border-border'
        }`}
      >
        {/* Adult content blur overlay */}
        {isAdultBlurred && (
          <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-black/60 backdrop-blur-sm">
            <EyeOff size={16} className="text-white/70" />
          </div>
        )}

        <div
          className={`relative w-12 h-12 flex-shrink-0 select-none ${isAdultBlurred ? 'blur-md' : ''}`}
        >
          <div className="w-full h-full rounded-lg overflow-hidden bg-glass">
            {thumbnailUrl && !imageError ? (
              <>
                {imageLoading && (
                  <div className="absolute inset-0 flex items-center justify-center bg-glass">
                    <Loader size="sm" />
                  </div>
                )}
                <img
                  src={thumbnailUrl}
                  alt={game.name}
                  draggable={false}
                  className={`w-full h-full object-cover transition-opacity duration-300 ${
                    imageLoading ? 'opacity-0' : 'opacity-100'
                  }`}
                  onLoad={() => setImageLoading(false)}
                  onError={() => {
                    setImageError(true);
                    setImageLoading(false);
                  }}
                />
              </>
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-neon-purple to-neon-blue flex items-center justify-center text-white font-bold text-sm">
                {game.name.charAt(0)}
              </div>
            )}
          </div>
          {hasUpdate && !isAdultBlurred && (
            <div className="absolute -top-1 -right-1 w-4 h-4 bg-neon-blue rounded-full border-2 border-bg-dark animate-pulse z-10" />
          )}
          {isGameDetected && !isAdultBlurred && (
            <div
              className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-bg-dark z-10"
              title="Гра встановлена"
            />
          )}
        </div>
        <div className={`flex-1 min-w-0 ${isAdultBlurred ? 'blur-md' : ''}`}>
          <h4 className="font-semibold text-sm text-white mb-1 truncate">
            {showTeamName ? game.team : game.name}
          </h4>
          {showTeamName && (
            <p className="text-xs text-text-muted mb-1 truncate">{averageProgress}%</p>
          )}
          {!showTeamName && (
            <div className="h-1 bg-glass-hover rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-neon-blue to-neon-purple rounded-full transition-all duration-500"
                style={{ width: `${averageProgress}%` }}
              />
            </div>
          )}
        </div>
      </div>
    );
  }
);
