import { useEffect, useRef, useState } from 'react';
import { t } from '@/shared/i18n/i18n';
import { useGamepadModeStore } from '../../store/useGamepadModeStore';
import { InstalledGamesSection } from './InstalledGamesSection';
import { NewGamesSection, type TabConfig } from './NewGamesSection';
import { RankedGamesPage } from './RankedGamesPage';
import { RankedGamesSection, type RankedTabs } from './RankedGamesSection';
import { WeeklyPicksSection } from './WeeklyPicksSection';

type PageView = 'main' | 'popular' | 'newStars';
type PopularKey = 'popularGames' | 'popularAllTimeGames';

const POPULAR_KEYS: readonly PopularKey[] = ['popularGames', 'popularAllTimeGames'];

export function MainPage() {
  const [currentView, setCurrentView] = useState<PageView>('main');
  const [popularKey, setPopularKey] = useState<PopularKey>('popularGames');
  const ContainerRef = useRef<HTMLDivElement>(null);
  const isGamepadMode = useGamepadModeStore((state) => state.isGamepadMode);

  // Scroll to top when opening a full list
  useEffect(() => {
    if (currentView !== 'main' && ContainerRef.current) {
      ContainerRef.current.scrollTo({ top: 0, behavior: 'auto' });
    }

    const { isGamepadMode, navigationArea } = useGamepadModeStore.getState();
    if (!isGamepadMode || navigationArea !== 'main-content') {
      return;
    }
    document
      .querySelector<HTMLElement>(
        `[data-gamepad-main-content] .main-page:not([style*="display: none"]) [data-gamepad-card]`
      )
      ?.focus();
  }, [currentView]);

  const newsTabsConfig: TabConfig[] = [
    {
      label: t('homeSections.newTranslations'),
      sortOrder: 'newest',
    },
    {
      label: t('homeSections.updates'),
      sortOrder: 'updated',
    },
  ];

  const popularTabs: RankedTabs<PopularKey> = {
    keys: POPULAR_KEYS,
    label: (key) => t(`homeSections.popularTabs.${key}`),
    onChange: setPopularKey,
  };

  return (
    <div
      ref={ContainerRef}
      data-gamepad-main-content
      className={`flex-1 grid grid-cols-1 justify-items-center items-start px-8 ${isGamepadMode ? 'py-4' : ''} overflow-y-auto justify-center custom-scrollbar`}
    >
      {/* Main page */}
      {currentView === 'main' && (
        <div
          className={`main-page grid grid-rows-auto grid-cols-1 gap-10 h-auto w-full max-w-[1564px]`}
        >
          <InstalledGamesSection showLimit={3} />
          <WeeklyPicksSection />
          <NewGamesSection
            title={t('homeSections.newGames')}
            tabs={newsTabsConfig}
            defaultTabSortOrder="newest"
            showLimit={3}
          />
          <RankedGamesSection
            title={t('homeSections.newStars')}
            resourceKey="newStarGames"
            onViewAll={() => setCurrentView('newStars')}
          />
          <RankedGamesSection
            title={t('homeSections.popular')}
            resourceKey={popularKey}
            showDownloadCounter={true}
            tabs={popularTabs}
            onViewAll={() => setCurrentView('popular')}
          />
        </div>
      )}
      {currentView !== 'main' && (
        <div
          className={`main-page grid grid-rows-auto grid-cols-1 gap-10 h-auto w-full max-w-[1564px]`}
        >
          {currentView === 'popular' ? (
            <RankedGamesPage
              title={t('homeSections.popular')}
              resourceKey={popularKey}
              showDownloadCounter={true}
              tabs={popularTabs}
              onBack={() => setCurrentView('main')}
            />
          ) : (
            <RankedGamesPage
              title={t('homeSections.newStars')}
              resourceKey="newStarGames"
              onBack={() => setCurrentView('main')}
            />
          )}
        </div>
      )}
    </div>
  );
}
