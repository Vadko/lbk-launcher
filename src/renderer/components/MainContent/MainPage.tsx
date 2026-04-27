import React, { useEffect, useRef, useState } from 'react';
import { useGamepadModeStore } from '../../store/useGamepadModeStore';
import { InstalledGamesSection } from './InstalledGamesSection';
import { NewGamesSection, type TabConfig } from './NewGamesSection';
import { TrendingGamesPage } from './TrendingGamesPage';
import { TrendGamesSection } from './TrendsGamesSection';

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
      {currentView === 'main' && (
        <div className={`main-page grid grid-rows-auto gap-10 h-auto w-full`}>
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
        <div className={`main-page grid grid-rows-auto gap-10 h-auto w-full`}>
          <TrendingGamesPage onBack={() => setCurrentView('main')} />
        </div>
      )}
    </div>
  );
};
