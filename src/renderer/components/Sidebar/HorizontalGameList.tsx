import { motion } from 'framer-motion';
import React, { useMemo } from 'react';
import { useListAnimation } from '../../hooks/useListAnimation';
import { useVirtualizedList } from '../../hooks/useVirtualizedList';
import type { Game } from '../../types/game';
import { Loader } from '../ui/Loader';
import { GamepadCard } from './GamepadCard';
import type { GameGroup } from './types';

/** How many items to render initially (progressive rendering) */
const INITIAL_RENDER = 15;
/** Approximate width of one card in px (w-36 + gap-3 = 156) */
const ITEM_WIDTH_ESTIMATE = 156;

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
    const slugs = useMemo(() => gameGroups.map((g) => g.slug), [gameGroups]);

    const { getAnimationProps } = useListAnimation({
      slugs,
      animationsEnabled,
      staggerCount: 6,
      direction: 'x',
    });

    const { renderCount, sentinelRef } = useVirtualizedList({
      totalItems: gameGroups.length,
      initialRenderCount: INITIAL_RENDER,
      incrementCount: 10,
      rootMargin: '100px',
      enabled: true,
    });

    const visibleGroups = useMemo(
      () => gameGroups.slice(0, renderCount),
      [gameGroups, renderCount]
    );

    const keyPrefix = useMemo(() => {
      const first = gameGroups[0]?.slug ?? '';
      const last = gameGroups[gameGroups.length - 1]?.slug ?? '';
      return `${gameGroups.length}_${first}_${last}`;
    }, [gameGroups]);

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
        {visibleGroups.map((group, index) => {
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

          const card = (
            <GamepadCard
              game={primaryGame}
              translations={group.translations}
              translationIndex={0}
              isSelected={isSelected}
              hasUpdate={hasUpdate}
              isDetected={detected}
              onClick={handleClick}
            />
          );

          const animProps = getAnimationProps(group.slug, index);

          return (
            <motion.div
              key={`${keyPrefix}_${group.slug}`}
              className="flex-shrink-0"
              initial={animProps?.initial ?? false}
              animate={animProps?.animate}
              transition={animProps?.transition}
            >
              {card}
            </motion.div>
          );
        })}

        {renderCount < gameGroups.length && (
          <div
            ref={sentinelRef}
            className="flex-shrink-0"
            style={{
              width: (gameGroups.length - renderCount) * ITEM_WIDTH_ESTIMATE,
            }}
            aria-hidden="true"
          />
        )}
      </div>
    );
  }
);
