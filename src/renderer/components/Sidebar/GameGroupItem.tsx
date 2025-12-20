import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, EyeOff } from 'lucide-react';
import { GameListItem } from './GameListItem';
import { Loader } from '../ui/Loader';
import { getGameImageUrl } from '../../utils/imageUrl';
import { useSettingsStore } from '../../store/useSettingsStore';
import type { GameGroup } from './types';
import type { Game } from '../../types/game';

interface GameGroupItemProps {
  group: GameGroup;
  isExpanded: boolean;
  onToggle: () => void;
  selectedGameId: string | undefined;
  onSelectGame: (game: Game) => void;
  gamesWithUpdates: Set<string>;
  isGameDetected: (gameId: string) => boolean;
  isHorizontalMode?: boolean;
}

export const GameGroupItem: React.FC<GameGroupItemProps> = React.memo(
  ({
    group,
    isExpanded,
    onToggle,
    selectedGameId,
    onSelectGame,
    gamesWithUpdates,
    isGameDetected,
    isHorizontalMode = false,
  }) => {
    const [imageLoading, setImageLoading] = useState(true);
    const [imageError, setImageError] = useState(false);
    const showAdultGames = useSettingsStore((state) => state.showAdultGames);

    const primaryGame = group.translations[0];
    const isAnySelected = group.translations.some((t) => selectedGameId === t.id);
    const anyHasUpdate = group.translations.some((t) => gamesWithUpdates.has(t.id));
    const anyGameDetected = group.translations.some((t) => isGameDetected(t.id));

    // Use thumbnail from the first translation
    const thumbnailUrl = getGameImageUrl(primaryGame.thumbnail_path);

    // Check if primary game is adult
    const isAdultBlurred = primaryGame.is_adult && !showAdultGames;

    // Calculate average progress from all translations
    const avgProgress = Math.round(
      group.translations.reduce(
        (sum, t) => sum + (t.translation_progress + t.editing_progress) / 2,
        0
      ) / group.translations.length
    );

    return (
      <div className="game-group">
        {/* Group Header - styled like GameListItem */}
        <div
          role="button"
          tabIndex={0}
          onClick={onToggle}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onToggle();
            }
          }}
          {...(isHorizontalMode ? { 'data-gamepad-card': true } : {})}
          className={`game-list-item relative flex gap-3 p-3 rounded-xl cursor-pointer transition-all duration-300 outline-none ${
            isHorizontalMode ? 'w-[200px] flex-col' : ''
          } ${
            isAnySelected
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

          {/* Thumbnail */}
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
                    alt={group.name}
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
                  {group.name.charAt(0)}
                </div>
              )}
            </div>
            {anyHasUpdate && !isAdultBlurred && (
              <div className="absolute -top-1 -right-1 w-4 h-4 bg-neon-blue rounded-full border-2 border-bg-dark animate-pulse z-10" />
            )}
            {anyGameDetected && !isAdultBlurred && (
              <div
                className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-bg-dark z-10"
                title="Гра встановлена"
              />
            )}
          </div>

          {/* Content */}
          <div className={`flex-1 min-w-0 ${isAdultBlurred ? 'blur-md' : ''}`}>
            <h4 className="font-semibold text-sm text-text-main mb-1 truncate">
              {group.name}
            </h4>
            <div className="h-1 bg-glass-hover rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-neon-blue to-neon-purple rounded-full transition-all duration-500"
                style={{ width: `${avgProgress}%` }}
              />
            </div>
          </div>

          {/* Translations count + Chevron */}
          <div className="flex-shrink-0 flex items-center gap-1 self-center">
            {group.translations.length > 1 && (
              <span className="text-[10px] font-medium text-text-muted">
                {group.translations.length}
              </span>
            )}
            <ChevronDown
              size={16}
              className={`text-text-muted transition-transform duration-200 ${
                isExpanded ? 'rotate-180' : ''
              }`}
            />
          </div>
        </div>

        {/* Expanded translations list */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="pl-3 mt-1 space-y-1 border-l-2 border-border ml-3">
                {group.translations.map((game) => (
                  <GameListItem
                    key={game.id}
                    game={game}
                    isSelected={selectedGameId === game.id}
                    onClick={() => onSelectGame(game)}
                    hasUpdate={gamesWithUpdates.has(game.id)}
                    isGameDetected={isGameDetected(game.id)}
                    showTeamName
                  />
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }
);
