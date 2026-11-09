import { AnimatePresence, motion } from 'framer-motion';
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useShallow } from 'zustand/react/shallow';
import { useStore } from '@/renderer/store/useStore';
import { trackEvent } from '@/renderer/utils/analytics';
import { t } from '@/shared/i18n/i18n';
import { useIsTranslationInstalled } from '../../hooks/useInstalledTranslations';
import { useResource } from '../../hooks/useResource';
import { GameListItem } from '../Sidebar/GameListItem';
import { Loader } from '../ui/Loader';

export const WeeklyPicksSection: React.FC = () => {
  const isInstalled = useIsTranslationInstalled();
  const navigate = useNavigate();
  const { gamesWithUpdates, isGameDetected } = useStore(
    useShallow((state) => ({
      gamesWithUpdates: state.gamesWithUpdates,
      isGameDetected: state.isGameDetected,
    }))
  );
  const picks = useResource('weeklyPicks');

  if (
    picks.status === 'failed' ||
    picks.value === null ||
    picks.value?.games.length === 0
  ) {
    return null;
  }
  // A const binding: TS drops the narrowing of picks.value inside the map callback below
  const set = picks.value;

  return (
    <section>
      <div className="mb-8">
        {/* Keeps the height while the set loads without flashing a default title */}
        <h2
          className={`text-4xl font-head font-semibold text-text-main ${set ? '' : 'invisible'}`}
        >
          {set?.title ?? t('homeSections.weeklyPicks')}
        </h2>
      </div>
      <div className="grid grid-cols-3 gap-8">
        <AnimatePresence mode="popLayout">
          {set === undefined ? (
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
            set.games.map((game, index) => (
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
                      'Weekly pick title': set.title ?? 'default',
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
