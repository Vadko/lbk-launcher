import { ThumbsUp } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { GameRatingItem, TeamRatingItem } from '@/shared/types';
import { StatusBadge } from '../components/Elements/StatusBadge';
import { type RatingsColumn, RatingsTable } from '../components/Ratings/RatingsTable';
import { Button } from '../components/ui/Button';
import { PillTabs } from '../components/ui/PillTabs';
import { useGamesRating } from '../queries/useGamesRating';
import { RATINGS_PAGE_SIZE, useTeamsRating } from '../queries/useTeamsRating';
import { useGamepadModeStore } from '../store/useGamepadModeStore';
import { useSettingsStore } from '../store/useSettingsStore';
import { useStore } from '../store/useStore';

type RatingsTab = 'teams' | 'games';

const tabs: { id: RatingsTab; label: string }[] = [
  { id: 'teams', label: 'Спілки' },
  { id: 'games', label: 'Ігри' },
];

const MUTED = 'text-text-muted';

const numberFormat = new Intl.NumberFormat('uk-UA');

const formatDownloads = (downloads: number) =>
  downloads < 20 ? 'до 20' : numberFormat.format(downloads);

const likesCell = (likes: number) => (
  <span className="inline-flex items-center gap-1.5 font-bold text-color-main">
    <ThumbsUp size={14} />
    {numberFormat.format(likes)}
  </span>
);

const detailsButton = (onClick: () => void) => (
  <Button
    onClick={onClick}
    data-gamepad-action
    className="!min-h-0 !px-4 !py-2 !text-sm mx-auto"
  >
    Детальніше
  </Button>
);

const getTotalPages = (total: number | undefined) =>
  total ? Math.max(1, Math.ceil(total / RATINGS_PAGE_SIZE)) : 1;

export const RatingsPage: React.FC = () => {
  const navigate = useNavigate();
  const setSelectedGame = useStore((state) => state.setSelectedGame);
  const [tab, setTab] = useState<RatingsTab>('teams');
  const [teamsPage, setTeamsPage] = useState(1);
  const [gamesPage, setGamesPage] = useState(1);
  const hideAi = useSettingsStore((state) => state.hideAiTranslations);
  const teams = useTeamsRating(teamsPage);
  const games = useGamesRating(gamesPage);

  useEffect(() => {
    setSelectedGame(null);
  }, [setSelectedGame]);

  useEffect(() => {
    setTeamsPage(1);
    setGamesPage(1);
  }, [hideAi]);

  const teamColumns: RatingsColumn<TeamRatingItem>[] = [
    {
      header: 'Назва спілки',
      render: (t) => t.name,
      className: 'truncate text-white font-bold',
    },
    { header: 'Вподобання', render: (t) => likesCell(t.likes) },
    { header: 'Переклади', render: (t) => t.translations, className: MUTED },
    {
      header: 'Завантаження',
      render: (t) => formatDownloads(t.downloads),
      className: MUTED,
    },
    {
      header: '',
      render: (t) =>
        detailsButton(() => {
          useSettingsStore.getState().setSelectedAuthors([t.name]);
          navigate('/');
        }),
    },
  ];

  const gameColumns: RatingsColumn<GameRatingItem>[] = [
    {
      header: 'Назва гри',
      render: (g) => g.name,
      className: 'truncate text-white font-bold',
    },
    { header: 'Вподобання', render: (g) => likesCell(g.likes) },
    {
      header: 'Завантаження',
      render: (g) => formatDownloads(g.downloads),
      className: MUTED,
    },
    {
      header: 'Статус перекладу',
      render: (g) => <StatusBadge status={g.status} style="capsule" />,
    },
    { header: '', render: (g) => detailsButton(() => navigate(`/game/${g.id}`)) },
  ];

  return (
    <div
      data-gamepad-main-content
      className={`flex-1 grid grid-cols-1 justify-items-center items-start px-8 ${useGamepadModeStore.getState().isGamepadMode && 'py-4'} overflow-y-auto justify-center custom-scrollbar`}
    >
      <div className="main-page flex flex-col gap-6 h-auto w-full max-w-[1564px]">
        <div className="flex justify-between items-end">
          <div className="grid gap-2">
            <h1 className="text-4xl font-head font-semibold text-text-main">
              Рейтинги української локалізації
            </h1>
            <p className="text-text-muted">
              Спілки перекладачів та ігри за оцінками гравців
            </p>
          </div>

          <PillTabs tabs={tabs} activeTab={tab} onChange={setTab} />
        </div>

        {tab === 'teams' ? (
          <RatingsTable
            columns={teamColumns}
            items={teams.data?.items}
            getKey={(t) => t.name}
            offset={(teamsPage - 1) * RATINGS_PAGE_SIZE}
            page={teamsPage}
            totalPages={getTotalPages(teams.data?.total)}
            onPageChange={setTeamsPage}
            isPending={teams.isPending}
            isError={teams.isError}
            isPlaceholderData={teams.isPlaceholderData}
            paginationLabel="Сторінки рейтингу спілок"
            caption="Рейтинг спілок за вподобаннями"
          />
        ) : (
          <RatingsTable
            columns={gameColumns}
            items={games.data?.items}
            getKey={(g) => g.id}
            offset={(gamesPage - 1) * RATINGS_PAGE_SIZE}
            page={gamesPage}
            totalPages={getTotalPages(games.data?.total)}
            onPageChange={setGamesPage}
            isPending={games.isPending}
            isError={games.isError}
            isPlaceholderData={games.isPlaceholderData}
            paginationLabel="Сторінки рейтингу ігор"
            caption="Рейтинг ігор за вподобаннями"
          />
        )}
      </div>
    </div>
  );
};
