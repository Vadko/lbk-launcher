import React, { useRef, useState } from 'react';
import { useGamepadModeStore } from '../../store/useGamepadModeStore';
import { GamesSection } from './GamesSection';
import { GamesSectionWithTabs, type TabConfig } from './GamesSectionWithTabs';
import { InstalledGamesSection } from './InstalledGamesSection';
import { TrendingGamesPage } from './TrendingGamesPage';

type PageView = 'main' | 'trending';

export const MainPage: React.FC = () => {
  const [currentView, setCurrentView] = useState<PageView>('main');
  const containerRef = useRef<HTMLDivElement>(null);

  const newsTabsConfig: TabConfig[] = [
    {
      label: 'Нові переклади',
      sortOrder: 'newest',
    },
    {
      label: 'Оновлення',
      sortOrder: 'updated',
    },
  ];

  return (
    <>
      {/* Trending games page */}
      <div
        ref={currentView === 'trending' ? containerRef : null}
        data-gamepad-main-content
        className={`flex-1 grid items-center px-8 ${useGamepadModeStore.getState().isGamepadMode && 'pb-3'} overflow-y-auto justify-center custom-scrollbar scrollbar-gutter-[stable] ${currentView !== 'trending' ? 'hidden' : ''}`}
      >
        <div className="grid grid-rows-auto gap-10 h-auto w-full">
          <TrendingGamesPage onBack={() => setCurrentView('main')} />
        </div>
      </div>

      {/* Main page */}
      <div
        ref={currentView === 'main' ? containerRef : null}
        data-gamepad-main-content
        className={`flex-1 grid items-center px-8 ${useGamepadModeStore.getState().isGamepadMode && 'pb-3'} overflow-y-auto justify-center custom-scrollbar scrollbar-gutter-[stable] ${currentView !== 'main' ? 'hidden' : ''}`}
      >
        <div className="grid grid-rows-auto gap-10 h-auto w-full">
          <InstalledGamesSection showLimit={3} />
          <GamesSectionWithTabs
            title="Новинки"
            tabs={newsTabsConfig}
            defaultTabSortOrder="newest"
            showLimit={3}
          />
          <GamesSection
            title="Популярне у гравців"
            showDownloadCounter={true}
            showTrendsGames={true}
            onViewAll={() => setCurrentView('trending')}
          />
        </div>
      </div>
    </>
  );
};
