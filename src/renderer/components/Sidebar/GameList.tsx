import { motion } from 'framer-motion';
import React, { useMemo } from 'react';
import { useListAnimation } from '../../hooks/useListAnimation';
import { useVirtualizedList } from '../../hooks/useVirtualizedList';
import type { Game } from '../../types/game';
import { Loader } from '../ui/Loader';
import { GameGroupItem } from './GameGroupItem';
import { GameListItem } from './GameListItem';
import type { GameGroup } from './types';

/** How many items to render initially (progressive rendering) */
const INITIAL_RENDER = 30;
/** Approximate height of one game item in px (for scrollbar stability) */
const ITEM_HEIGHT_ESTIMATE = 76;

interface GameListProps {
  gameGroups: GameGroup[];
  totalGames: number;
  isLoading: boolean;
  animationsEnabled: boolean;
  expandedGroups: Set<string>;
  selectedGameId: string | undefined;
  gamesWithUpdates: Set<string>;
  onToggleGroup: (slug: string) => void;
  onSelectGame: (game: Game) => void;
  isGameDetected: (gameId: string) => boolean;
}

export const GameList: React.FC<GameListProps> = React.memo(
  ({
    gameGroups,
    totalGames,
    isLoading,
    animationsEnabled,
    expandedGroups,
    selectedGameId,
    gamesWithUpdates,
    onToggleGroup,
    onSelectGame,
    isGameDetected,
  }) => {
    const slugs = useMemo(() => gameGroups.map((g) => g.slug), [gameGroups]);

    const { getAnimationProps } = useListAnimation({
      slugs,
      animationsEnabled,
      staggerCount: 8,
      direction: 'y',
    });

    const { renderCount, sentinelRef } = useVirtualizedList({
      totalItems: gameGroups.length,
      initialRenderCount: INITIAL_RENDER,
      incrementCount: 20,
      enabled: true,
    });

    const visibleGroups = useMemo(
      () => gameGroups.slice(0, renderCount),
      [gameGroups, renderCount]
    );

    // Key prefix that changes when list composition changes, forcing items
    // to remount so framer-motion replays the initial animation.
    const keyPrefix = useMemo(() => {
      const first = gameGroups[0]?.slug ?? '';
      const last = gameGroups[gameGroups.length - 1]?.slug ?? '';
      return `${gameGroups.length}_${first}_${last}`;
    }, [gameGroups]);

    if (isLoading) {
      return (
        <div className="flex items-center justify-center py-12">
          <Loader size="md" />
        </div>
      );
    }

    if (totalGames === 0) {
      return (
        <div className="text-center text-text-muted py-8">
          <p>Ігор не знайдено</p>
        </div>
      );
    }

    return (
      <div className="space-y-2 relative">
        {visibleGroups.map((group, index) => {
          const hasMultipleTranslations = group.translations.length > 1;
          const primaryGame = group.translations[0];

          const content = hasMultipleTranslations ? (
            <GameGroupItem
              group={group}
              isExpanded={expandedGroups.has(group.slug)}
              onToggle={() => onToggleGroup(group.slug)}
              selectedGameId={selectedGameId}
              onSelectGame={onSelectGame}
              gamesWithUpdates={gamesWithUpdates}
              isGameDetected={isGameDetected}
            />
          ) : (
            <GameListItem
              game={primaryGame}
              isSelected={selectedGameId === primaryGame.id}
              onClick={() => onSelectGame(primaryGame)}
              hasUpdate={gamesWithUpdates.has(primaryGame.id)}
              isGameDetected={isGameDetected(primaryGame.id)}
            />
          );

          const animProps = getAnimationProps(group.slug, index);

          return (
            <motion.div
              key={`${keyPrefix}_${group.slug}`}
              id={`group-${group.slug}`}
              initial={animProps?.initial ?? false}
              animate={animProps?.animate}
              transition={animProps?.transition}
            >
              {content}
            </motion.div>
          );
        })}

        {renderCount < gameGroups.length && (
          <div
            ref={sentinelRef}
            style={{
              height: (gameGroups.length - renderCount) * ITEM_HEIGHT_ESTIMATE,
            }}
            aria-hidden="true"
          />
        )}
      </div>
    );
  }
);
