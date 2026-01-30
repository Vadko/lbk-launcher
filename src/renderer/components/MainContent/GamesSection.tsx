import { AnimatePresence, motion } from 'framer-motion';
import React, { useMemo } from 'react';
import { useGames } from '@/renderer/hooks/useGames';
import { useStore } from '@/renderer/store/useStore';
import { useTrendingGames } from '../../queries/useTrendingGames';
import { GameListItem } from '../Sidebar/GameListItem';
import { Loader } from '../ui/Loader';

interface GamesSectionProps {
  title: string;
  showLimit?: number;
  showDownloadCounter?: boolean;
  showTrendsGames?: boolean;
  sortOrder?: 'downloads' | 'name' | 'newest';
}

export const GamesSection: React.FC<GamesSectionProps> = ({
  title,
  showLimit = 3,
  showDownloadCounter = false,
  showTrendsGames = false,
  sortOrder = 'name',
}) => {
  const { setSelectedGame } = useStore();
  const { games: allGames, isLoading: isLoadingAll } = useGames({ sortOrder });
  const { data: trendingGames, isLoading: isLoadingTrends } = useTrendingGames(
    30,
    showLimit
  );
  const games = useMemo(
    () => (showTrendsGames ? (trendingGames ?? []) : allGames),
    [showTrendsGames, trendingGames, allGames]
  );
  const isLoading = showTrendsGames ? isLoadingTrends : isLoadingAll;
  const visibleGames = useMemo(() => games.slice(0, showLimit), [games, showLimit]);

  return (
    <div className="text-left w-full max-w-[1317px]">
      <h2 className="text-4xl font-head font-semibold text-text-main mb-8">{title}</h2>
      <div className={`grid grid-cols-3 gap-8`}>
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
          ) : visibleGames.length === 0 ? (
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
            visibleGames.map((game, index) => (
              <motion.div
                key={game.slug}
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
                  showDownloadCounter={showDownloadCounter}
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
