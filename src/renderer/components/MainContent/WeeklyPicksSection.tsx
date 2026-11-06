import { AnimatePresence, motion } from 'framer-motion';
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useShallow } from 'zustand/react/shallow';
import { useWeeklyPicks } from '@/renderer/queries/useWeeklyPicks';
import { useSettingsStore } from '@/renderer/store/useSettingsStore';
import { useStore } from '@/renderer/store/useStore';
import { trackEvent } from '@/renderer/utils/analytics';
import { t } from '@/shared/i18n/i18n';
import { useIsTranslationInstalled } from '../../hooks/useInstalledTranslations';
import { GameListItem } from '../Sidebar/GameListItem';
import { Loader } from '../ui/Loader';

export const WeeklyPicksSection: React.FC = () => {
  const isInstalled = useIsTranslationInstalled();
  const navigate = useNavigate();
  const hideAiTranslations = useSettingsStore((state) => state.hideAiTranslations);
  const { gamesWithUpdates, isGameDetected } = useStore(
    useShallow((state) => ({
      gamesWithUpdates: state.gamesWithUpdates,
      isGameDetected: state.isGameDetected,
    }))
  );
  const { picks, games, isLoading } = useWeeklyPicks(hideAiTranslations);

  if (!isLoading && games.length === 0) {
    return null;
  }

  return (
    <section>
      <div className="mb-8">
        {/* Keeps the height while the set loads without flashing a default title */}
        <h2
          className={`text-4xl font-head font-semibold text-text-main ${picks ? '' : 'invisible'}`}
        >
          {picks?.title ?? t('homeSections.weeklyPicks')}
        </h2>
      </div>
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
            games.map((game, index) => (
              <motion.div
                key={game.id}
                id={`weekly-pick-${game.slug}`}
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
                  hasUpdate={gamesWithUpdates.has(game.id)}
                  isGameDetected={isGameDetected(game.id)}
                  isInstalled={isInstalled(game.id)}
                  isTranslationAvailable={
                    game.status !== 'planned' && game.status !== 'tech-improvement'
                  }
                  onClick={() => {
                    trackEvent('Select game', {
                      'Is weekly pick': true,
                      'Weekly pick title': picks?.title ?? 'default',
                      'Game Id': game.id,
                      'Game Name': game.name,
                    });
                    navigate(`/game/${game.id}`);
                  }}
                />
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>
    </section>
  );
};
