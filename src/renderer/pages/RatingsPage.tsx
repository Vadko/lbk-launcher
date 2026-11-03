import { ThumbsUpIcon } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatDownloads } from '@/shared/formatters';
import { t } from '@/shared/i18n/i18n';
import type { GameRatingItem, TeamRatingItem } from '@/shared/ratings-api-types';
import { StatusBadge } from '../components/Elements/StatusBadge';
import { type RatingsColumn, RatingsTable } from '../components/Ratings/RatingsTable';
import { Button } from '../components/ui/Button';
import { PillTabs } from '../components/ui/PillTabs';
import { useRatingsInvalidation } from '../hooks/useRatingsInvalidation';
import { useRatings } from '../queries/useRatings';
import { useGamepadModeStore } from '../store/useGamepadModeStore';
import { useStore } from '../store/useStore';
import { showOnlyAuthors } from '../utils/showOnlyAuthors';

type RatingsTab = 'teams' | 'games';

const TABS: readonly RatingsTab[] = ['teams', 'games'];

const MUTED = 'text-text-muted';
const NAME = 'truncate text-text-main font-bold';

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

const detailsHeader = <span className="sr-only">{t('ratings.column.details')}</span>;

export const RatingsPage: React.FC = () => {
  const navigate = useNavigate();
  const setSelectedGame = useStore((state) => state.setSelectedGame);
  const isGamepadMode = useGamepadModeStore((state) => state.isGamepadMode);
  const [tab, setTab] = useState<RatingsTab>('teams');
  const scrollerRef = useRef<HTMLDivElement>(null);
  const teams = useRatings('teams', window.electronAPI.fetchTeamsRating);
  const games = useRatings('games', window.electronAPI.fetchGamesRating);
  useRatingsInvalidation();

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
      header: detailsHeader,
      render: (team) =>
        detailsButton(() => {
          showOnlyAuthors([team.name]);
          navigate('/');
          if (isGamepadMode) {
            const gamepad = useGamepadModeStore.getState();
            gamepad.setNavigationArea('games');
            gamepad.setFocusedGameIndex(0);
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
      id: 'downloads',
      header: t('ratings.column.downloads'),
      render: (game) => formatDownloads(game.downloads),
      className: MUTED,
    },
    {
      id: 'status',
      header: t('ratings.column.status'),
      render: (game) => <StatusBadge status={game.status} style="capsule" />,
    },
    {
      id: 'details',
      header: detailsHeader,
      render: (game) => detailsButton(() => navigate(`/game/${game.id}`)),
    },
  ];

  return (
    <div
      ref={scrollerRef}
      data-gamepad-main-content
      className={`flex-1 grid grid-cols-1 justify-items-center items-start px-8 ${isGamepadMode ? 'py-4' : ''} overflow-y-auto justify-center custom-scrollbar`}
    >
      <div className="main-page flex flex-col gap-6 h-auto w-full max-w-[1564px]">
        <div className="flex justify-between items-end">
          <div className="grid gap-2">
            <h1 className="text-4xl font-head font-semibold text-text-main">
              {t('ratings.title')}
            </h1>
            <p className="text-text-muted">{t('ratings.subtitle')}</p>
          </div>

          <PillTabs
            tabs={TABS}
            active={tab}
            label={(id) => t(`ratings.tab.${id}`)}
            onChange={setTab}
          />
        </div>

        {tab === 'teams' ? (
          <RatingsTable
            columns={teamColumns}
            query={teams}
            getKey={(team) => team.name}
            caption={t('ratings.caption.teams')}
            scrollerRef={scrollerRef}
          />
        ) : (
          <RatingsTable
            columns={gameColumns}
            query={games}
            getKey={(game) => game.id}
            caption={t('ratings.caption.games')}
            scrollerRef={scrollerRef}
          />
        )}
      </div>
    </div>
  );
};
