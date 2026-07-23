import { AnimatePresence, motion } from 'framer-motion';
import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useShallow } from 'zustand/react/shallow';
import { useRecommendedGames } from '@/renderer/queries/useRecommendedGames';
import { useSettingsStore } from '@/renderer/store/useSettingsStore';
import { useStore } from '@/renderer/store/useStore';
import { trackEvent } from '@/renderer/utils/analytics';
import { GameListItem } from '../Sidebar/GameListItem';
import { Loader } from '../ui/Loader';

interface RecommendedGamesSectionProps {
  gameId: string;
  gameName?: string;
  title?: string;
  showLimit?: number;
}

export const RecommendedGamesSection: React.FC<RecommendedGamesSectionProps> = ({
  gameId,
  gameName,
  title = 'Вас може зацікавити',
  showLimit = 3,
}) => {
  const navigate = useNavigate();
  const { hideAiTranslations } = useSettingsStore(
    useShallow((state) => ({
      hideAiTranslations: state.hideAiTranslations,
    }))
  );
  const { gamesWithUpdates, isGameDetected, getInstallationInfo } = useStore(
    useShallow((state) => ({
      gamesWithUpdates: state.gamesWithUpdates,
      isGameDetected: state.isGameDetected,
      getInstallationInfo: state.getInstallationInfo,
    }))
  );

  const { data: recommendedGames = [], isLoading } = useRecommendedGames(
    gameId,
    showLimit,
    hideAiTranslations
  );

  const visibleGames = useMemo(
    () => recommendedGames.filter((game) => game.id !== gameId).slice(0, showLimit),
    [recommendedGames, gameId, showLimit]
  );

  if (!isLoading && visibleGames.length === 0) {
    return null;
  }

  return (
    <motion.section
      layout="position"
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className="glass-card-no-motion mb-6"
    >
      <h3 className="text-lg font-head font-semibold text-text-main mb-3">{title}</h3>
      <div className="grid grid-cols-3 gap-8">
        <AnimatePresence>
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
                key={game.id}
                id={`recommended-game-${game.slug}`}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: 0.3,
                  delay: index * 0.05,
                  ease: 'easeInOut',
                }}
              >
                <GameListItem
                  game={game}
                  isSelected={false}
                  isCardStyle={true}
                  hasUpdate={gamesWithUpdates.has(game.id)}
                  isGameDetected={isGameDetected(game.id)}
                  isInstalled={!!getInstallationInfo(game.id)}
                  isTranslationAvailable={
                    game.status !== 'planned' && game.status !== 'tech-improvement'
                  }
                  onClick={() => {
                    trackEvent('Select game', {
                      'Is recommendation': true,
                      'Source Game Id': gameId,
                      'Source Game Name': gameName,
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
    </motion.section>
  );
};
