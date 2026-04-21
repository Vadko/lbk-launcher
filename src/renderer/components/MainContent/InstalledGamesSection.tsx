import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import React, { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useGames } from '@/renderer/hooks/useGames';
import { useGamepadModeStore } from '@/renderer/store/useGamepadModeStore';
import { useSettingsStore } from '@/renderer/store/useSettingsStore';
import { useStore } from '@/renderer/store/useStore';
import { WarningFillIcon } from '../Icons/WarningFillIcon';
import { GameListItem } from '../Sidebar/GameListItem';
import { Button } from '../ui/Button';
import { Loader } from '../ui/Loader';

interface InstalledGamesSectionProps {
  title?: string;
  showLimit?: number;
}

export const InstalledGamesSection: React.FC<InstalledGamesSectionProps> = ({
  title = 'Знайдено встановлені ігри',
  showLimit = 3,
}) => {
  const { hideAiTranslations } = useSettingsStore(
    useShallow((state) => ({
      hideAiTranslations: state.hideAiTranslations,
    }))
  );
  const { setSelectedGame, installedGames } = useStore(
    useShallow((state) => ({
      setSelectedGame: state.setSelectedGame,
      installedGames: state.installedGames,
    }))
  );

  // Load all installed games (from system)
  const { games: allInstalledGames, isLoading } = useGames({
    specialFilter: 'installed-games',
    hideAiTranslations,
    sortOrder: 'newest',
  });

  // Filter to show only games WITHOUT translations installed
  const gamesWithoutInstalls = useMemo(
    () => allInstalledGames.filter((game) => !installedGames.has(game.id)),
    [allInstalledGames, installedGames]
  );

  const visibleGames = useMemo(
    () => gamesWithoutInstalls.slice(0, showLimit),
    [gamesWithoutInstalls, showLimit]
  );

  const handleViewAll = () => {
    // Activate installed-games filter in sidebar
    useSettingsStore.getState().setSpecialFilter('installed-games');

    // For gamepad mode, switch to games navigation area
    if (useGamepadModeStore.getState().isGamepadMode) {
      useGamepadModeStore.getState().setNavigationArea('games');
      useGamepadModeStore.getState().setFocusedGameIndex(0);
    }
  };

  // Show banner instead of section when no games found
  if (!isLoading && gamesWithoutInstalls.length === 0) {
    return (
      <div className="text-left w-full max-w-[1317px]">
        <AnimatePresence mode="wait">
          <motion.div
            key="empty-banner"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
          >
            <div className="glass-card-no-motion !p-4 flex gap-6 items-center">
              <WarningFillIcon size={32} />
              <div className="flex-1">
                <h3 className="text-2xl font-head font-bold text-color-mixed mb-1">
                  Не можемо знайти ваші ігри
                </h3>
                <p className="text-sm">
                  От халепа... Ми не змогли знайти встановлені ігри на девайсі.
                  <br />
                  Будь ласка, переконайтеся, що ви маєте хоча б одну завантажену гру у
                  лаунчерах — Steam, GOG, EGS.
                </p>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    );
  }

  return (
    <div className="text-left w-full max-w-[1317px]">
      {/* Header with button */}
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-4xl font-head font-semibold text-text-main">{title}</h2>
        {allInstalledGames.length > showLimit && (
          <Button
            variant="ghost"
            data-gamepad-action
            data-gamepad-primary-action
            onClick={handleViewAll}
          >
            Переглянути всі
            <ArrowRight size={24} />
          </Button>
        )}
      </div>

      {/* Content */}
      <div className="grid grid-cols-3 gap-8">
        <AnimatePresence mode="popLayout">
          {isLoading ? (
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
            visibleGames.map((game, index) => (
              <motion.div
                key={`${game.id}-installed`}
                id={`game-${game.slug}`}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: 0.4,
                  delay: Math.min(index * 0.03, 0.5),
                  ease: [0.25, 0.46, 0.45, 0.94],
                }}
              >
                <GameListItem
                  game={game}
                  isSelected={false}
                  isCardStyle={true}
                  showDownloadCounter={false}
                  onClick={() => setSelectedGame(game)}
                />
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
