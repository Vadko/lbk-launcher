import { AnimatePresence, motion } from 'framer-motion';
import React, { useMemo } from 'react';
import { useVirtualizedList } from '../../hooks/useVirtualizedList';
import type { Game } from '../../types/game';
import { Loader } from '../ui/Loader';
import { GameGroupItem } from './GameGroupItem';
import { GameListItem } from './GameListItem';
import type { GameGroup } from './types';

interface GameListProps {
  gameGroups: GameGroup[];
  totalGames: number;
  isLoading: boolean;
  animationsEnabled: boolean;
  expandedGroups: Set<string>;
  selectedGameId: string | undefined;
  gamesWithUpdates: Set<string>;
  listKey: string;
  onToggleGroup: (slug: string) => void;
  onSelectGame: (game: Game) => void;
  isGameDetected: (gameId: string) => boolean;
}

const GameList: React.FC<GameListProps> = React.memo(
  ({
    gameGroups,
    totalGames,
    isLoading,
    animationsEnabled,
    expandedGroups,
    selectedGameId,
    gamesWithUpdates,
    listKey,
    onToggleGroup,
    onSelectGame,
    isGameDetected,
  }) => {
    // Progressive rendering (only when animations disabled)
    const { renderCount, sentinelRef } = useVirtualizedList({
      totalItems: gameGroups.length,
      initialRenderCount: 30,
      incrementCount: 20,
      enabled: !animationsEnabled,
    });

    const visibleGroups = useMemo(
      () => (animationsEnabled ? gameGroups : gameGroups.slice(0, renderCount)),
      [gameGroups, renderCount, animationsEnabled]
    );

    if (isLoading) {
      return animationsEnabled ? (
        <motion.div
          key="loader"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3, ease: 'easeInOut' }}
          className="flex items-center justify-center py-12"
        >
          <Loader size="md" />
        </motion.div>
      ) : (
        <div className="flex items-center justify-center py-12">
          <Loader size="md" />
        </div>
      );
    }

    if (totalGames === 0) {
      return animationsEnabled ? (
        <motion.div
          key="empty"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.3, ease: 'easeInOut' }}
          className="text-center text-text-muted py-8"
        >
          <p>Ігор не знайдено</p>
        </motion.div>
      ) : (
        <div className="text-center text-text-muted py-8">
          <p>Ігор не знайдено</p>
        </div>
      );
    }

    const renderGameItem = (group: GameGroup, index: number) => {
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

      if (animationsEnabled) {
        return (
          <motion.div
            key={group.slug}
            id={`group-${group.slug}`}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: 0.4,
              delay: Math.min(index * 0.03, 0.5),
              ease: [0.25, 0.46, 0.45, 0.94],
            }}
          >
            {content}
          </motion.div>
        );
      }

      return (
        <div key={group.slug} id={`group-${group.slug}`}>
          {content}
        </div>
      );
    };

    const listContent = (
      <>
        {visibleGroups.map((group, index) => renderGameItem(group, index))}
        {/* Sentinel for progressive loading */}
        {!animationsEnabled && renderCount < gameGroups.length && (
          <div ref={sentinelRef} className="h-4" aria-hidden="true" />
        )}
      </>
    );

    if (animationsEnabled) {
      return (
        <motion.div
          key={listKey}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25, ease: 'easeInOut' }}
          className="space-y-2 relative"
        >
          {listContent}
        </motion.div>
      );
    }

    return <div className="space-y-2 relative">{listContent}</div>;
  }
);

interface AnimatedGameListProps extends GameListProps {}

export const AnimatedGameList: React.FC<AnimatedGameListProps> = (props) => {
  if (props.animationsEnabled) {
    return (
      <AnimatePresence mode="wait">
        <GameList {...props} />
      </AnimatePresence>
    );
  }

  return <GameList {...props} />;
};
