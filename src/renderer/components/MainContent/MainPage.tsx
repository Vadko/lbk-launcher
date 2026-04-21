import React, { Activity, useEffect, useRef, useState } from 'react';
import { useGamepadModeStore } from '../../store/useGamepadModeStore';
import { GamesSection } from './GamesSection';
import { GamesSectionWithTabs, type TabConfig } from './GamesSectionWithTabs';
import { InstalledGamesSection } from './InstalledGamesSection';
import { TrendingGamesPage } from './TrendingGamesPage';

type PageView = 'main' | 'trending';

export const MainPage: React.FC = () => {
  const [currentView, setCurrentView] = useState<PageView>('main');
  const ContainerRef = useRef<HTMLDivElement>(null);

  // Scroll to top when opening trending page
  useEffect(() => {
    if (currentView === 'trending' && ContainerRef.current) {
      ContainerRef.current.scrollTo({ top: 0, behavior: 'auto' });
    }

    const isGamepadMode = useGamepadModeStore.getState().isGamepadMode;
    if (!isGamepadMode) return;
    document
      .querySelector<HTMLElement>(
        `[data-gamepad-main-content] .main-page:not([style*="display: none"]) [data-gamepad-card]`
      )
      ?.focus();
  }, [currentView]);

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
    <div
      ref={ContainerRef}
      data-gamepad-main-content
      className={`flex-1 grid items-center px-8 ${useGamepadModeStore.getState().isGamepadMode && 'py-4'} overflow-y-auto justify-center custom-scrollbar scrollbar-gutter-[stable]`}
    >
      {/* Main page */}
      <Activity mode={currentView === 'main' ? 'visible' : 'hidden'}>
        <div className={`main-page grid grid-rows-auto gap-10 h-auto w-full`}>
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
      </Activity>
      {/* Trending games page */}
      <Activity mode={currentView === 'trending' ? 'visible' : 'hidden'}>
        <div className={`main-page grid grid-rows-auto gap-10 h-auto w-full`}>
          <TrendingGamesPage onBack={() => setCurrentView('main')} />
        </div>
      </Activity>
    </div>
  );
};
