import { useVirtualizer } from '@tanstack/react-virtual';
import { motion } from 'framer-motion';
import React, { useEffect, useMemo } from 'react';
import type { InstallationInfo } from '../../../shared/types';
import { useListAnimation } from '../../hooks/useListAnimation';
import { useListCompositionKey } from '../../hooks/useListCompositionKey';
import { useGamepadModeStore } from '../../store/useGamepadModeStore';
import type { Game } from '../../types/game';
import { Loader } from '../ui/Loader';
import { GAMEPAD_CARD_STRIDE } from './constants';
import { GamepadCard } from './GamepadCard';
import type { GameGroup } from './types';

interface HorizontalGameListProps {
  gameGroups: GameGroup[];
  totalGames: number;
  isLoading: boolean;
  animationsEnabled: boolean;
  selectedGameId: string | undefined;
  gamesWithUpdates: Set<string>;
  scrollRef: React.RefObject<HTMLDivElement | null>;
  onSelectGame: (game: Game) => void;
  onOpenTranslationPicker: (
    translations: Game[],
    gameName: string,
    variantById: Map<string, string>
  ) => void;
  isGameDetected: (gameId: string) => boolean;
  getInstallationInfo: (gameId: string) => InstallationInfo | undefined;
}

export const HorizontalGameList: React.FC<HorizontalGameListProps> = React.memo(
  ({
    gameGroups,
    totalGames,
    isLoading,
    animationsEnabled,
    selectedGameId,
    gamesWithUpdates,
    scrollRef,
    onSelectGame,
    onOpenTranslationPicker,
    isGameDetected,
    getInstallationInfo,
  }) => {
    const keys = useMemo(() => gameGroups.map((g) => g.key), [gameGroups]);

    const { getAnimationProps } = useListAnimation({
      keys,
      animationsEnabled,
      staggerCount: 6,
      direction: 'x',
    });

    const virtualizer = useVirtualizer({
      horizontal: true,
      count: gameGroups.length,
      getScrollElement: () => scrollRef.current,
      estimateSize: () => GAMEPAD_CARD_STRIDE,
      overscan: 8,
      getItemKey: (index) => gameGroups[index].key,
    });

    // Даємо геймпад-навігації канонічний scrollToIndex віртуалізатора,
    // щоб вона могла доскролити до ще не змонтованої картки
    const setScrollGameListToIndex = useGamepadModeStore(
      (s) => s.setScrollGameListToIndex
    );
    useEffect(() => {
      setScrollGameListToIndex((index) =>
        virtualizer.scrollToIndex(index, { align: 'auto' })
      );
      return () => setScrollGameListToIndex(null);
    }, [virtualizer, setScrollGameListToIndex]);

    const keyPrefix = useListCompositionKey(gameGroups, scrollRef, 'horizontal');

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
      <div className="relative h-48" style={{ width: virtualizer.getTotalSize() }}>
        {virtualizer.getVirtualItems().map((virtualCol) => {
          const group = gameGroups[virtualCol.index];
          const primaryGame = group.translations[0];
          const isSelected = group.translations.some((t) => selectedGameId === t.id);
          const hasUpdate = group.translations.some((t) => gamesWithUpdates.has(t.id));
          const detected = group.translations.some((t) => isGameDetected(t.id));

          const handleClick = () => {
            if (group.translations.length > 1) {
              onOpenTranslationPicker(group.translations, group.name, group.variantById);
            } else {
              onSelectGame(primaryGame);
            }
          };

          const animProps = getAnimationProps(group.key, virtualCol.index);

          return (
            <div
              key={virtualCol.key}
              data-gamepad-index={virtualCol.index}
              className="absolute inset-y-0 left-0"
              style={{ transform: `translateX(${virtualCol.start}px)` }}
            >
              <motion.div
                key={`${keyPrefix}_${group.key}`}
                initial={animProps?.initial ?? false}
                animate={animProps?.animate ?? { opacity: 1, x: 0 }}
                transition={animProps?.transition}
              >
                <GamepadCard
                  game={primaryGame}
                  translations={group.translations}
                  translationIndex={0}
                  isSelected={isSelected}
                  hasUpdate={hasUpdate}
                  isDetected={detected}
                  isInstalled={!!getInstallationInfo(primaryGame.id)}
                  onClick={handleClick}
                  imageDeferred={virtualizer.isScrolling}
                />
              </motion.div>
            </div>
          );
        })}
      </div>
    );
  }
);
