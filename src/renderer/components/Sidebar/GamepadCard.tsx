import React, { useState } from 'react';
import { EyeOff } from 'lucide-react';
import { Loader } from '../ui/Loader';
import { getGameImageUrl } from '../../utils/imageUrl';
import { useSettingsStore } from '../../store/useSettingsStore';
import type { Game } from '../../types/game';

interface GamepadCardProps {
  game: Game;
  isSelected: boolean;
  hasUpdate: boolean;
  isDetected: boolean;
  onClick: () => void;
}

export const GamepadCard: React.FC<GamepadCardProps> = ({
  game,
  isSelected,
  hasUpdate,
  isDetected,
  onClick,
}) => {
  const [imageLoading, setImageLoading] = useState(true);
  const [imageError, setImageError] = useState(false);
  const showAdultGames = useSettingsStore((state) => state.showAdultGames);

  const thumbnailUrl = getGameImageUrl(game.thumbnail_path);
  const isAdultBlurred = game.is_adult && !showAdultGames;

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
        ${isSelected
          ? 'ring-2 ring-neon-blue shadow-[0_0_20px_rgba(0,242,255,0.5)] scale-105 z-10'
          : 'ring-1 ring-white/10 hover:ring-white/30 hover:scale-102'
        }
        focus:ring-2 focus:ring-neon-blue focus:shadow-[0_0_20px_rgba(0,242,255,0.5)]
      `}
    >
      {/* Adult blur overlay */}
      {isAdultBlurred && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/70 backdrop-blur-md">
          <EyeOff size={24} className="text-white/50" />
        </div>
      )}

      {/* Image */}
      <div className={`relative aspect-[3/4] bg-glass ${isAdultBlurred ? 'blur-lg' : ''}`}>
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
              className={`w-full h-full object-cover transition-opacity duration-200 ${
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
          <div className="w-full h-full bg-gradient-to-br from-neon-purple/50 to-neon-blue/50 flex items-center justify-center">
            <span className="text-white/70 font-bold text-2xl">
              {game.name.charAt(0)}
            </span>
          </div>
        )}

        {/* Gradient overlay at bottom */}
        <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/80 to-transparent" />

        {/* Game name */}
        <div className="absolute inset-x-0 bottom-0 p-2">
          <p className={`text-xs font-medium text-white line-clamp-2 ${isAdultBlurred ? 'blur-sm' : ''}`}>
            {game.name}
          </p>
        </div>

        {/* Update indicator */}
        {hasUpdate && !isAdultBlurred && (
          <div className="absolute top-2 right-2 w-3 h-3 bg-neon-blue rounded-full animate-pulse shadow-[0_0_8px_rgba(0,242,255,0.8)]" />
        )}

        {/* Installed indicator */}
        {isDetected && !isAdultBlurred && (
          <div className="absolute top-2 left-2 w-3 h-3 bg-green-500 rounded-full shadow-[0_0_8px_rgba(34,197,94,0.8)]" />
        )}
      </div>
    </div>
  );
};
