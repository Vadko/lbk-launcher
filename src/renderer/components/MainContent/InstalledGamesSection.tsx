import { AnimatePresence, motion } from 'framer-motion';
import { ListFilterIcon } from 'lucide-react';
import React, { useMemo } from 'react';
import { Trans } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useShallow } from 'zustand/react/shallow';
import { useIsTranslationInstalled } from '@/renderer/hooks/useInstalledTranslations';
import {
  useInstalledGamePathsCount,
  useInstalledGamesForHome,
} from '@/renderer/queries/useHomePageGames';
import { useGamepadModeStore } from '@/renderer/store/useGamepadModeStore';
import { useSettingsStore } from '@/renderer/store/useSettingsStore';
import { useStore } from '@/renderer/store/useStore';
import { getGameGroupKey } from '@/shared/game-filters';
import { t } from '@/shared/i18n/i18n';
import type { Game } from '@/shared/types';
import { WarningFillIcon } from '../Icons/WarningFillIcon';
import { GameListItem } from '../Sidebar/GameListItem';
import { Button } from '../ui/Button';
import { Loader } from '../ui/Loader';

interface InstalledGamesSectionProps {
  title?: string;
  showLimit?: number;
}

export const InstalledGamesSection: React.FC<InstalledGamesSectionProps> = ({
  title = t('homeSections.installedGames'),
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
  const isInstalled = useIsTranslationInstalled();

  // One card per game, not per translation - two authors' translations are still one installed game
  const { gamesWithoutInstalls, installedGameCount } = useMemo(() => {
    const groups = new Map<string, Game[]>();
    for (const game of allInstalledGames) {
      const key = getGameGroupKey(game);
      const group = groups.get(key);
      if (group) {
        group.push(game);
      } else {
        groups.set(key, [game]);
      }
    }

    const cards = [...groups.values()].map((translations) => {
      const installed = translations.find((game) => isInstalled(game.id));
      return { game: installed ?? translations[0], isTranslated: Boolean(installed) };
    });

    // If no games without translations, show all installed games
    const withoutTranslations = cards.filter((card) => !card.isTranslated);
    const gamesToShow = (
      withoutTranslations.length > 0 ? withoutTranslations : cards
    ).map((card) => card.game);

    const hasUpdate = (game: Game) => {
      const installInfo = installedTranslations.get(game.id);
      return installInfo && game.version && installInfo.version !== game.version ? 1 : 0;
    };

    return {
      gamesWithoutInstalls: gamesToShow.sort((a, b) => hasUpdate(b) - hasUpdate(a)),
      installedGameCount: groups.size,
    };
  }, [allInstalledGames, installedTranslations, isInstalled]);

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
            <div className="glass-card-no-motion p-4! flex gap-6 items-center">
              <WarningFillIcon size={32} />
              <div className="flex-1">
                {hasInstalledGames ? (
                  <>
                    <h3 className="text-2xl font-head font-bold text-color-mixed mb-1">
                      {t('installedGamesBanner.noTranslationsTitle')}
                    </h3>
                    <p className="text-sm">
                      <Trans
                        i18nKey="installedGamesBanner.noTranslationsText"
                        components={{ br: <br /> }}
                      />
                    </p>
                  </>
                ) : (
                  <>
                    <h3 className="text-2xl font-head font-bold text-color-mixed mb-1">
                      {t('installedGamesBanner.noGamesTitle')}
                    </h3>
                    <p className="text-sm">
                      <Trans
                        i18nKey="installedGamesBanner.noGamesText"
                        components={{ br: <br /> }}
                      />
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
        {installedGameCount > showLimit && (
          <Button
            variant="ghost"
            data-gamepad-action
            data-gamepad-primary-action
            onClick={handleViewAll}
          >
            {t('homeSections.viewAll')}
            <ListFilterIcon size={14} />
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
