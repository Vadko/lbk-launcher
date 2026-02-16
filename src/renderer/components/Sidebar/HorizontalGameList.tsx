import React, { useMemo } from 'react';
import { useVirtualizedList } from '../../hooks/useVirtualizedList';
import type { Game } from '../../types/game';
import { Loader } from '../ui/Loader';
import { GamepadCard } from './GamepadCard';
import type { GameGroup } from './types';

interface HorizontalGameListProps {
  gameGroups: GameGroup[];
  totalGames: number;
  isLoading: boolean;
  animationsEnabled: boolean;
  selectedGameId: string | undefined;
  gamesWithUpdates: Set<string>;
  onSelectGame: (game: Game) => void;
  onOpenTranslationPicker: (translations: Game[], gameName: string) => void;
  isGameDetected: (gameId: string) => boolean;
}

export const HorizontalGameList: React.FC<HorizontalGameListProps> = React.memo(
  ({
    gameGroups,
    totalGames,
    isLoading,
    animationsEnabled,
    selectedGameId,
    gamesWithUpdates,
    onSelectGame,
    onOpenTranslationPicker,
    isGameDetected,
  }) => {
    // Progressive rendering for horizontal scroll
    const { renderCount, sentinelRef } = useVirtualizedList({
      totalItems: gameGroups.length,
      initialRenderCount: 15,
      incrementCount: 10,
      rootMargin: '100px',
      enabled: !animationsEnabled,
    });

    const visibleGroups = useMemo(
      () => (animationsEnabled ? gameGroups : gameGroups.slice(0, renderCount)),
      [gameGroups, renderCount, animationsEnabled]
    );

    if (isLoading) {
      return (
        <div className="flex items-center justify-center h-32">
          <Loader size="md" />
        </div>
      );
    }

    if (totalGames === 0) {
      return (
        <div className="flex items-center justify-center h-32 text-text-muted">
          <p>Ігор не знайдено</p>
        </div>
      );
    }

    return (
      <div className="flex gap-3">
        {visibleGroups.map((group) => {
          const primaryGame = group.translations[0];
          const isSelected = group.translations.some((t) => selectedGameId === t.id);
          const hasUpdate = group.translations.some((t) => gamesWithUpdates.has(t.id));
          const detected = group.translations.some((t) => isGameDetected(t.id));

          const handleClick = () => {
            if (group.translations.length > 1) {
              onOpenTranslationPicker(group.translations, group.name);
            } else {
              onSelectGame(primaryGame);
            }
          };

          return (
            <GamepadCard
              key={group.slug}
              game={primaryGame}
              translations={group.translations}
              translationIndex={0}
              isSelected={isSelected}
              hasUpdate={hasUpdate}
              isDetected={detected}
              onClick={handleClick}
            />
          );
        })}
        {/* Sentinel for progressive loading (horizontal) */}
        {!animationsEnabled && renderCount < gameGroups.length && (
          <div ref={sentinelRef} className="w-4 flex-shrink-0" aria-hidden="true" />
        )}
      </div>
    );
  }
);
