import { useVirtualizer } from '@tanstack/react-virtual';
import { motion } from 'framer-motion';
import React, { useMemo } from 'react';
import type { InstallationInfo } from '../../../shared/types';
import { useListAnimation } from '../../hooks/useListAnimation';
import { useListCompositionKey } from '../../hooks/useListCompositionKey';
import type { Game } from '../../types/game';
import { Loader } from '../ui/Loader';
import { GAME_LIST_ROW_ESTIMATE } from './constants';
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
  scrollRef: React.RefObject<HTMLDivElement | null>;
  onToggleGroup: (key: string) => void;
  onSelectGame: (game: Game) => void;
  isGameDetected: (gameId: string) => boolean;
  getInstallationInfo: (gameId: string) => InstallationInfo | undefined;
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
    scrollRef,
    onToggleGroup,
    onSelectGame,
    isGameDetected,
    getInstallationInfo,
  }) => {
    const keys = useMemo(() => gameGroups.map((g) => g.key), [gameGroups]);

    const { getAnimationProps } = useListAnimation({
      keys,
      animationsEnabled,
      staggerCount: 8,
      direction: 'y',
    });

    const virtualizer = useVirtualizer({
      count: gameGroups.length,
      getScrollElement: () => scrollRef.current,
      estimateSize: () => GAME_LIST_ROW_ESTIMATE,
      overscan: 10,
      getItemKey: (index) => gameGroups[index].key,
    });

    const keyPrefix = useListCompositionKey(gameGroups, scrollRef, 'vertical');

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

    const isScrolling = virtualizer.isScrolling;

    return (
      <div className="relative" style={{ height: virtualizer.getTotalSize() }}>
        {virtualizer.getVirtualItems().map((virtualRow) => {
          const group = gameGroups[virtualRow.index];
          const hasMultipleTranslations = group.translations.length > 1;
          const primaryGame = group.translations[0];

          const content = hasMultipleTranslations ? (
            <GameGroupItem
              group={group}
              isExpanded={expandedGroups.has(group.key)}
              onToggle={() => onToggleGroup(group.key)}
              selectedGameId={selectedGameId}
              onSelectGame={onSelectGame}
              gamesWithUpdates={gamesWithUpdates}
              isGameDetected={isGameDetected}
              getInstallationInfo={getInstallationInfo}
              imageDeferred={isScrolling}
            />
          ) : (
            <GameListItem
              game={primaryGame}
              isSelected={selectedGameId === primaryGame.id}
              onClick={() => onSelectGame(primaryGame)}
              hasUpdate={gamesWithUpdates.has(primaryGame.id)}
              isGameDetected={isGameDetected(primaryGame.id)}
              isInstalled={!!getInstallationInfo(primaryGame.id)}
              isTranslationAvailable={
                primaryGame.status !== 'planned' &&
                primaryGame.status !== 'tech-improvement'
              }
              imageDeferred={isScrolling}
            />
          );

          const animProps = getAnimationProps(group.key, virtualRow.index);

          return (
            <div
              key={virtualRow.key}
              ref={virtualizer.measureElement}
              data-index={virtualRow.index}
              id={`group-${group.key}`}
              className="absolute top-0 left-0 w-full pb-2"
              style={{ transform: `translateY(${virtualRow.start}px)` }}
            >
              <motion.div
                key={`${keyPrefix}_${group.key}`}
                initial={animProps?.initial ?? false}
                animate={animProps?.animate ?? { opacity: 1, y: 0 }}
                transition={animProps?.transition}
              >
                {content}
              </motion.div>
            </div>
          );
        })}
      </div>
    );
  }
);
