import React, { useEffect, useRef } from 'react';
import { useGamepadModeStore } from '../../store/useGamepadModeStore';
import { useStore } from '../../store/useStore';
import { InstalledGamesSection } from './InstalledGamesSection';
import { NewGamesSection, type TabConfig } from './NewGamesSection';
import { NewsFeedSection } from './NewsFeedSection';
import { TrendingGamesPage } from './TrendingGamesPage';
import { TrendGamesSection } from './TrendsGamesSection';

export const MainPage: React.FC = () => {
  const currentView = useStore((state) => state.mainPageView);
  const setCurrentView = useStore((state) => state.setMainPageView);
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
      className={`flex-1 grid grid-cols-1 justify-items-center items-start px-8 ${useGamepadModeStore.getState().isGamepadMode && 'py-4'} overflow-y-auto justify-center custom-scrollbar scrollbar-gutter-[stable]`}
    >
      {/* Main page */}
      {currentView === 'main' && (
        <div
          className={`main-page grid grid-rows-auto grid-cols-1 gap-10 h-auto w-full max-w-[1317px]`}
        >
          <InstalledGamesSection showLimit={3} />
          <NewGamesSection
            title="Новинки"
            tabs={newsTabsConfig}
            defaultTabSortOrder="newest"
            showLimit={3}
          />
          <TrendGamesSection
            title="Популярне у гравців"
            showDownloadCounter={true}
            onViewAll={() => setCurrentView('trending')}
          />
        </div>
      )}
      {/* Trending games page */}
      {currentView === 'trending' && (
        <div
          className={`main-page grid grid-rows-auto grid-cols-1 gap-10 h-auto w-full max-w-[1317px]`}
        >
          <TrendingGamesPage onBack={() => setCurrentView('main')} />
        </div>
      )}
      {/* News page */}
      {currentView === 'news' && (
        <div
          className={`main-page grid grid-rows-auto grid-cols-1 gap-10 h-auto w-full max-w-[1317px]`}
        >
          <NewsFeedSection />
        </div>
      )}
    </div>
  );
};
