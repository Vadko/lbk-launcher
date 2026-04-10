import { AnimatePresence, motion } from 'framer-motion';
import React, { useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useGames } from '@/renderer/hooks/useGames';
import { useSettingsStore } from '@/renderer/store/useSettingsStore';
import { useStore } from '@/renderer/store/useStore';
import { useTrendingGames } from '../../queries/useTrendingGames';
import { GameListItem } from '../Sidebar/GameListItem';
import { Loader } from '../ui/Loader';

export interface TabConfig {
  label: string;
  sortOrder: 'newest' | 'updated' | 'downloads' | 'name';
  showDownloadCounter?: boolean;
  showTrendsGames?: boolean;
}

interface GamesSectionWithTabsProps {
  title: string;
  tabs: TabConfig[];
  defaultTabSortOrder?: 'newest' | 'updated' | 'downloads' | 'name';
  showLimit?: number;
}

export const GamesSectionWithTabs: React.FC<GamesSectionWithTabsProps> = ({
  title,
  tabs,
  defaultTabSortOrder,
  showLimit = 3,
}) => {
  const [activeTabSortOrder, setActiveTabSortOrder] = useState<string>(
    defaultTabSortOrder || tabs[0]?.sortOrder || ''
  );

  const { hideAiTranslations } = useSettingsStore(
    useShallow((state) => ({
      hideAiTranslations: state.hideAiTranslations,
    }))
  );
  const { setSelectedGame } = useStore();

  // Find active tab config
  const activeTab = useMemo(
    () => tabs.find((tab) => tab.sortOrder === activeTabSortOrder) || tabs[0],
    [tabs, activeTabSortOrder]
  );

  // Load games based on active tab configuration
  const { games: allGames, isLoading: isLoadingAll } = useGames({
    sortOrder: activeTab?.sortOrder || 'name',
    hideAiTranslations,
  });
  const { data: trendingGames, isLoading: isLoadingTrends } = useTrendingGames(
    30,
    showLimit
  );

  const games = useMemo(
    () => (activeTab?.showTrendsGames ? (trendingGames ?? []) : allGames),
    [activeTab?.showTrendsGames, trendingGames, allGames]
  );
  const isLoading = activeTab?.showTrendsGames ? isLoadingTrends : isLoadingAll;
  const visibleGames = useMemo(() => games.slice(0, showLimit), [games, showLimit]);

  return (
    <div className="text-left w-full max-w-[1317px]">
      {/* Header with tabs */}
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-4xl font-head font-semibold text-text-main">{title}</h2>
        <div className="glass-card-no-motion flex gap-2">
          {tabs.map((tab) => (
            <button
              key={tab.sortOrder}
              onClick={() => setActiveTabSortOrder(tab.sortOrder)}
              data-gamepad-action
              className={`px-6 py-2 rounded-xl font-medium transition-all ${
                activeTabSortOrder === tab.sortOrder
                  ? 'bg-gradient-to-r from-color-accent to-color-main text-text-dark'
                  : 'bg-surface-elevated text-text-muted hover:text-text-main hover:bg-surface-elevated/80'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="grid grid-cols-3 gap-8">
        <AnimatePresence mode="wait" initial={false}>
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
            <React.Fragment key={`games-${activeTabSortOrder}`}>
              {visibleGames.map((game, index) => (
                <motion.div
                  key={`${game.id}-${activeTabSortOrder}`}
                  id={`game-${game.slug}`}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
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
                    showDownloadCounter={activeTab?.showDownloadCounter}
                    onClick={() => setSelectedGame(game)}
                  />
                </motion.div>
              ))}
            </React.Fragment>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
