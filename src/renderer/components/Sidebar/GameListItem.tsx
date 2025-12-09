import React, { useState } from 'react';
import { EyeOff } from 'lucide-react';
import { Game } from '../../types/game';
import { getGameImageUrl } from '../../utils/imageUrl';
import { Loader } from '../ui/Loader';
import { useSettingsStore } from '../../store/useSettingsStore';

interface GameListItemProps {
  game: Game;
  isSelected: boolean;
  onClick: () => void;
  hasUpdate?: boolean;
  isGameDetected?: boolean;
}

export const GameListItem: React.FC<GameListItemProps> = React.memo(({
  game,
  isSelected,
  onClick,
  hasUpdate = false,
  isGameDetected = false,
}) => {
  const [imageLoading, setImageLoading] = useState(true);
  const [imageError, setImageError] = useState(false);
  const showAdultGames = useSettingsStore((state) => state.showAdultGames);

  // Check if this is an adult game that should be blurred
  const isAdultBlurred = game.is_adult && !showAdultGames;

  const averageProgress = Math.round(
    (game.translation_progress + game.editing_progress) / 2
  );

  const thumbnailUrl = getGameImageUrl(game.thumbnail_path);

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

      <div className={`relative w-12 h-12 flex-shrink-0 select-none ${isAdultBlurred ? 'blur-md' : ''}`}>
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
          <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-bg-dark z-10" title="Гра встановлена" />
        )}
      </div>
      <div className={`flex-1 min-w-0 ${isAdultBlurred ? 'blur-md' : ''}`}>
        <h4 className="font-semibold text-sm text-white mb-1 truncate">
          {game.name}
        </h4>
        <div className="h-1 bg-glass-hover rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-neon-blue to-neon-purple rounded-full transition-all duration-500"
            style={{ width: `${averageProgress}%` }}
          />
        </div>
      </div>
    </div>
  );
});
