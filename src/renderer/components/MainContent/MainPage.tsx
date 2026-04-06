import React from 'react';
import { useGamepadModeStore } from '../../store/useGamepadModeStore';
import { GamesSection } from './GamesSection';
import { GamesSectionWithTabs, type TabConfig } from './GamesSectionWithTabs';
import { InstalledGamesSection } from './InstalledGamesSection';

export const MainPage: React.FC = () => {
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
      data-gamepad-main-content
      className={`flex-1 grid items-center px-8 ${useGamepadModeStore.getState().isGamepadMode && 'pb-3'} overflow-y-auto justify-center custom-scrollbar scrollbar-gutter-[stable]`}
    >
      <div className="grid grid-rows-auto gap-10 h-auto">
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
        />
      </div>
    </div>
  );
};
