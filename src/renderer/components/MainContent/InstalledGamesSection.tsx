import { AnimatePresence, motion } from 'framer-motion';
import { ListFilter } from 'lucide-react';
import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useShallow } from 'zustand/react/shallow';
import {
  useInstalledGamePathsCount,
  useInstalledGamesForHome,
} from '@/renderer/queries/useHomePageGames';
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
  const navigate = useNavigate();

  const { hideAiTranslations } = useSettingsStore(
    useShallow((state) => ({
      hideAiTranslations: state.hideAiTranslations,
    }))
  );
  const { installedTranslations } = useStore(
    useShallow((state) => ({
      setSelectedGame: state.setSelectedGame,
      installedTranslations: state.installedTranslations,
    }))
  );

  // Load all installed games (from system) with caching
  const { data: allInstalledGames = [], isLoading } = useInstalledGamesForHome(
    hideAiTranslations,
    'newest'
  );

  const { data: installedPathsCount = 0 } = useInstalledGamePathsCount();

  // Filter and sort games
  const gamesWithoutInstalls = useMemo(() => {
    const withoutTranslations = allInstalledGames.filter(
      (game) => !installedTranslations.has(game.id)
    );

    // If no games without translations, show all installed games
    const gamesToShow =
      withoutTranslations.length > 0 ? withoutTranslations : allInstalledGames;

    // Sort by update availability - games with updates first
    return gamesToShow.sort((a, b) => {
      const aInstallInfo = installedTranslations.get(a.id);
      const bInstallInfo = installedTranslations.get(b.id);

      const aHasUpdate =
        aInstallInfo && a.version && aInstallInfo.version !== a.version ? 1 : 0;
      const bHasUpdate =
        bInstallInfo && b.version && bInstallInfo.version !== b.version ? 1 : 0;

      // Sort: games with updates first (descending)
      return bHasUpdate - aHasUpdate;
    });
  }, [allInstalledGames, installedTranslations]);

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

  // Show banner instead of section when no games with translations found
  if (!isLoading && allInstalledGames.length === 0) {
    const hasInstalledGames = installedPathsCount > 0;

    return (
      <section>
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
                {hasInstalledGames ? (
                  <>
                    <h3 className="text-2xl font-head font-bold text-color-mixed mb-1">
                      Не знайшли перекладів для ваших ігор
                    </h3>
                    <p className="text-sm">
                      От халепа... Ми знайшли ваші ігри, але перекладів для них поки
                      немає.
                      <br />
                      Завантажте гру з нашого каталогу — відкрийте меню фільтрування, щоб
                      переглянути доступні переклади.
                    </p>
                  </>
                ) : (
                  <>
                    <h3 className="text-2xl font-head font-bold text-color-mixed mb-1">
                      Не можемо знайти ваші ігри
                    </h3>
                    <p className="text-sm">
                      От халепа... Ми не змогли знайти у вас встановлені ігри, для яких є
                      переклад.
                      <br />
                      Переконайтеся, що маєте хоча б одну гру з нашого каталогу у
                      лаунчерах — Steam, GOG, EGS. А ще можна відкрити меню фільтрування й
                      переглянути ігри, які ще не встановлені.
                    </p>
                  </>
                )}
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </section>
    );
  }

  return (
    <section>
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
            <ListFilter size={14} />
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
                  onClick={() => navigate(`/game/${game.id}`)}
                />
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>
    </section>
  );
};
