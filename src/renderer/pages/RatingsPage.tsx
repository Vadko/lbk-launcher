import { ThumbsUpIcon } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatDownloads } from '@/shared/formatters';
import { t } from '@/shared/i18n/i18n';
import type { GameRatingItem, TeamRatingItem } from '@/shared/ratings-api-types';
import { StatusBadge } from '../components/Elements/StatusBadge';
import { RatingsSearch } from '../components/Ratings/RatingsSearch';
import { type RatingsColumn, RatingsTable } from '../components/Ratings/RatingsTable';
import type { RatingsFilter } from '../components/Ratings/ratingsFilter';
import { Button } from '../components/ui/Button';
import { SlidingTabs } from '../components/ui/SlidingTabs';
import { useGamepadModeStore } from '../store/useGamepadModeStore';
import { useRatingsStore } from '../store/useRatingsStore';
import { useStore } from '../store/useStore';
import { showOnlyAuthors } from '../utils/showOnlyAuthors';

type RatingsTab = 'teams' | 'games';

const TABS: readonly RatingsTab[] = ['teams', 'games'];

const MUTED = 'text-text-muted';
const NAME = 'truncate text-text-main font-bold';

const teamKey = (team: TeamRatingItem) => team.name;
const gameKey = (game: GameRatingItem) => game.id;
const gameName = (game: GameRatingItem) => game.name;

const numberFormat = new Intl.NumberFormat('uk-UA');

const likesCell = (likes: number) => (
  <span className="inline-flex items-center gap-1.5 font-bold text-color-main">
    <ThumbsUpIcon size={14} />
    {numberFormat.format(likes)}
  </span>
);

const detailsButton = (onClick: () => void) => (
  <Button
    onClick={onClick}
    data-gamepad-action
    className="min-h-0! px-4! py-2! text-sm! mx-auto"
  >
    {t('ratings.details')}
  </Button>
);

export const RatingsPage: React.FC = () => {
  const navigate = useNavigate();
  const setSelectedGame = useStore((state) => state.setSelectedGame);
  const isGamepadMode = useGamepadModeStore((state) => state.isGamepadMode);
  const [tab, setTab] = useState<RatingsTab>('teams');
  const [pages, setPages] = useState<Record<RatingsTab, number>>({
    teams: 1,
    games: 1,
  });
  const setPage = (page: number) => setPages((prev) => ({ ...prev, [tab]: page }));
  const [filters, setFilters] = useState<Record<RatingsTab, RatingsFilter | null>>({
    teams: null,
    games: null,
  });
  const setFilter = (filter: RatingsFilter | null) => {
    setFilters((prev) => ({ ...prev, [tab]: filter }));
    setPage(1);
  };
  const teams = useRatingsStore((state) => state.teams);
  const games = useRatingsStore((state) => state.games);
  const failed = useRatingsStore((state) => state.failed);

  useEffect(() => {
    setSelectedGame(null);
  }, [setSelectedGame]);

  const teamColumns: RatingsColumn<TeamRatingItem>[] = [
    {
      id: 'name',
      header: t('ratings.column.team'),
      render: (team) => team.name,
      className: NAME,
    },
    {
      id: 'likes',
      header: t('ratings.column.likes'),
      render: (team) => likesCell(team.likes),
    },
    {
      id: 'translations',
      header: t('ratings.column.translations'),
      render: (team) => team.translations,
      className: MUTED,
    },
    {
      id: 'downloads',
      header: t('ratings.column.downloads'),
      render: (team) => formatDownloads(team.downloads),
      className: MUTED,
    },
    {
      id: 'details',
      header: <span className="sr-only">{t('ratings.column.details')}</span>,
      render: (team) =>
        detailsButton(() => {
          showOnlyAuthors([team.name]);
          useStore.getState().setSearchQuery('');
          navigate('/');
          if (isGamepadMode) {
            const gamepad = useGamepadModeStore.getState();
            // The area switch focuses the stored index at once, so the index goes first
            gamepad.setFocusedGameIndex(0);
            gamepad.setNavigationArea('games');
          }
        }),
    },
  ];

  const gameColumns: RatingsColumn<GameRatingItem>[] = [
    {
      id: 'name',
      header: t('ratings.column.game'),
      render: (game) => game.name,
      className: NAME,
    },
    {
      id: 'likes',
      header: t('ratings.column.likes'),
      render: (game) => likesCell(game.likes),
    },
    {
      id: 'status',
      header: t('ratings.column.status'),
      render: (game) => <StatusBadge status={game.status} style="capsule" />,
    },
    {
      id: 'downloads',
      header: t('ratings.column.downloads'),
      render: (game) => formatDownloads(game.downloads),
      className: MUTED,
    },
    {
      id: 'details',
      header: <span className="sr-only">{t('ratings.column.details')}</span>,
      render: (game) => detailsButton(() => navigate(`/game/${game.id}`)),
    },
  ];

  return (
    <div
      data-gamepad-main-content
      className={`flex-1 grid grid-cols-1 justify-items-center items-start px-8 ${isGamepadMode ? 'py-4' : ''} overflow-y-auto justify-center custom-scrollbar`}
    >
      <div className="main-page flex flex-col gap-6 h-auto w-full max-w-[1564px]">
        <div className="grid gap-2">
          <h1 className="text-4xl font-head font-semibold text-text-main">
            {t('ratings.title')}
          </h1>
          <p className="text-text-muted">{t('ratings.subtitle')}</p>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4">
          {tab === 'teams' ? (
            <RatingsSearch
              key="teams"
              items={teams ?? []}
              getKey={teamKey}
              getName={teamKey}
              filter={filters.teams}
              onFilter={setFilter}
              placeholder={t('ratings.search.placeholder.teams')}
            />
          ) : (
            <RatingsSearch
              key="games"
              items={games ?? []}
              getKey={gameKey}
              getName={gameName}
              filter={filters.games}
              onFilter={setFilter}
              placeholder={t('ratings.search.placeholder.games')}
            />
          )}
          <SlidingTabs
            tabs={TABS}
            active={tab}
            label={(id) => t(`ratings.tab.${id}`)}
            onChange={setTab}
          />
        </div>

        {tab === 'teams' ? (
          <RatingsTable
            columns={teamColumns}
            items={teams}
            failed={failed}
            getKey={teamKey}
            getName={teamKey}
            filter={filters.teams}
            caption={t('ratings.caption.teams')}
            page={pages.teams}
            onPageChange={setPage}
          />
        ) : (
          <RatingsTable
            columns={gameColumns}
            items={games}
            failed={failed}
            getKey={gameKey}
            getName={gameName}
            filter={filters.games}
            caption={t('ratings.caption.games')}
            page={pages.games}
            onPageChange={setPage}
          />
        )}
      </div>
    </div>
  );
};
